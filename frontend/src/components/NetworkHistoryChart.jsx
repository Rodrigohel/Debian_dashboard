import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const RANGES = [
  { key: '6h', label: '6h', hours: 6 },
  { key: '24h', label: '24h', hours: 24 },
  { key: '7d', label: '7 dias', hours: 24 * 7 },
  { key: '30d', label: '30 dias', hours: 24 * 30 },
];
const MAX_POINTS = 160;

// Reduz a séries a no máximo MAX_POINTS, tirando a média de cada janela —
// evita desenhar milhares de pontos (uma checagem a cada ~20s ao longo de
// dias) sem perder a forma geral do gráfico.
function downsample(rows) {
  if (rows.length <= MAX_POINTS) return rows;
  const bucketSize = Math.ceil(rows.length / MAX_POINTS);
  const buckets = [];
  for (let i = 0; i < rows.length; i += bucketSize) {
    const chunk = rows.slice(i, i + bucketSize);
    const avg = (key) => chunk.reduce((s, r) => s + (r[key] ?? 0), 0) / chunk.length;
    buckets.push({
      at: chunk[chunk.length - 1].at,
      total: avg('total'), online: avg('online'), offline: avg('offline'), degraded: avg('degraded'),
      avgLatencyMs: avg('avgLatencyMs'),
    });
  }
  return buckets;
}

function formatTick(iso, hours) {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const LEGEND = [
  { key: 'online', label: 'Online', color: 'green' },
  { key: 'degraded', label: 'Degradado', color: 'amber' },
  { key: 'offline', label: 'Offline', color: 'red' },
];

export default function NetworkHistoryChart({ colors }) {
  const [rangeKey, setRangeKey] = useState('24h');
  const [rows, setRows] = useState(null);
  const [hover, setHover] = useState(null);
  const range = RANGES.find((r) => r.key === rangeKey);

  useEffect(() => {
    let cancelled = false;
    api.networkHistory(range.hours).then((res) => { if (!cancelled) setRows(downsample(res.data)); });
    return () => { cancelled = true; };
  }, [range.hours]);

  useEffect(() => {
    const interval = setInterval(() => {
      api.networkHistory(range.hours).then((res) => setRows(downsample(res.data)));
    }, 60000);
    return () => clearInterval(interval);
  }, [range.hours]);

  const width = 900, height = 220, padLeft = 36, padRight = 12, padTop = 10, padBottom = 24;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const { areas, points, maxTotal, avgLatency } = useMemo(() => {
    if (!rows || rows.length < 2) return { areas: null, points: [], maxTotal: 1, avgLatency: null };
    const maxTotal = Math.max(1, ...rows.map((r) => r.total));
    const stepX = innerW / (rows.length - 1);
    const yFor = (v) => padTop + innerH - (v / maxTotal) * innerH;
    const xFor = (i) => padLeft + i * stepX;

    const pts = rows.map((r, i) => ({
      x: xFor(i), row: r,
      yOnlineTop: yFor(r.online),
      yDegradedTop: yFor(r.online + r.degraded),
      yOfflineTop: yFor(r.online + r.degraded + r.offline),
      yBase: yFor(0),
    }));

    function areaPath(topKey) {
      const top = pts.map((p) => `${p.x.toFixed(1)},${p[topKey].toFixed(1)}`).join(' L');
      const bottom = [...pts].reverse().map((p) => `${p.x.toFixed(1)},${p.yBase.toFixed(1)}`).join(' L');
      return `M${top} L${bottom} Z`;
    }
    function bandPath(topKey, baseKey) {
      const top = pts.map((p) => `${p.x.toFixed(1)},${p[topKey].toFixed(1)}`).join(' L');
      const bottom = [...pts].reverse().map((p) => `${p.x.toFixed(1)},${p[baseKey].toFixed(1)}`).join(' L');
      return `M${top} L${bottom} Z`;
    }

    const latencies = rows.map((r) => r.avgLatencyMs).filter((v) => v != null);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

    return {
      areas: {
        online: areaPath('yOnlineTop'),
        degraded: bandPath('yDegradedTop', 'yOnlineTop'),
        offline: bandPath('yOfflineTop', 'yDegradedTop'),
      },
      points: pts,
      maxTotal,
      avgLatency,
    };
  }, [rows, innerW, innerH]);

  function handleMove(e) {
    if (points.length === 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let closest = points[0], closestDist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.x - mouseX);
      if (d < closestDist) { closest = p; closestDist = d; }
    }
    setHover(closest);
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>
          Saúde da rede ao longo do tempo
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              style={{
                border: `1px solid ${rangeKey === r.key ? colors.primary : colors.border}`,
                background: rangeKey === r.key ? `${colors.primary}1A` : colors.bgCard,
                color: rangeKey === r.key ? colors.primary : colors.textSecondary,
                borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        {LEGEND.map((l) => (
          <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[l.color] }} /> {l.label}
          </span>
        ))}
        {avgLatency != null && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: colors.textTertiary }}>
            Latência média do período: <strong style={{ color: colors.textPrimary }}>{avgLatency.toFixed(0)} ms</strong>
          </span>
        )}
      </div>

      {!rows && <div style={{ fontSize: 13, color: colors.textSecondary, padding: '30px 0', textAlign: 'center' }}>Carregando histórico...</div>}
      {rows && rows.length < 2 && <div style={{ fontSize: 13, color: colors.textSecondary, padding: '30px 0', textAlign: 'center' }}>Ainda não há histórico suficiente neste período — volte em algumas rodadas de monitoramento.</div>}

      {rows && rows.length >= 2 && (
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'block', cursor: 'crosshair' }}
          >
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={padLeft} x2={width - padRight} y1={padTop + innerH * f} y2={padTop + innerH * f} stroke={colors.border} strokeWidth={1} />
            ))}
            <text x={4} y={padTop + 4} fontSize={9} fill={colors.textTertiary}>{maxTotal}</text>
            <text x={4} y={padTop + innerH + 4} fontSize={9} fill={colors.textTertiary}>0</text>

            <path d={areas.online} fill={colors.green} opacity={0.75} />
            <path d={areas.degraded} fill={colors.amber} opacity={0.75} />
            <path d={areas.offline} fill={colors.red} opacity={0.8} />

            {[0, points.length - 1].map((i) => (
              <text key={i} x={points[i].x} y={height - 6} fontSize={9} fill={colors.textTertiary} textAnchor={i === 0 ? 'start' : 'end'}>
                {formatTick(points[i].row.at, range.hours)}
              </text>
            ))}

            {hover && (
              <>
                <line x1={hover.x} x2={hover.x} y1={padTop} y2={padTop + innerH} stroke={colors.textTertiary} strokeWidth={1} strokeDasharray="3,3" />
                <circle cx={hover.x} cy={hover.yBase - (hover.row.online / maxTotal) * innerH} r={3} fill={colors.green} />
              </>
            )}
          </svg>

          {hover && (
            <div style={{
              position: 'absolute', left: `${Math.min(78, Math.max(2, (hover.x / width) * 100))}%`, top: 4,
              background: colors.bgCardAlt, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px',
              fontSize: 11.5, color: colors.textPrimary, boxShadow: colors.shadow, pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              <div style={{ color: colors.textTertiary, marginBottom: 4 }}>{new Date(hover.row.at).toLocaleString('pt-BR')}</div>
              <div style={{ color: colors.green, fontWeight: 700 }}>Online: {Math.round(hover.row.online)}</div>
              <div style={{ color: colors.amber, fontWeight: 700 }}>Degradado: {Math.round(hover.row.degraded)}</div>
              <div style={{ color: colors.red, fontWeight: 700 }}>Offline: {Math.round(hover.row.offline)}</div>
              {hover.row.avgLatencyMs != null && <div style={{ color: colors.textSecondary, marginTop: 2 }}>Latência: {hover.row.avgLatencyMs.toFixed(0)} ms</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
