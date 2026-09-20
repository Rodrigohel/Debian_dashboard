import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const RANGES = [
  { key: '6h', label: '6h', hours: 6 },
  { key: '24h', label: '24h', hours: 24 },
  { key: '7d', label: '7 dias', hours: 24 * 7 },
  { key: '30d', label: '30 dias', hours: 24 * 30 },
];
const MAX_POINTS = 160;

// Mesma lógica de downsample do gráfico de saúde da rede: reduz a série a no
// máximo MAX_POINTS pontos tirando a média de cada janela, pra não desenhar
// milhares de rodadas de monitoramento acumuladas ao longo de dias.
function downsample(rows) {
  if (rows.length <= MAX_POINTS) return rows;
  const bucketSize = Math.ceil(rows.length / MAX_POINTS);
  const buckets = [];
  for (let i = 0; i < rows.length; i += bucketSize) {
    const chunk = rows.slice(i, i + bucketSize);
    const avg = (key) => {
      const vals = chunk.map((r) => r[key]).filter((v) => v != null);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    buckets.push({
      at: chunk[chunk.length - 1].at,
      avgLatencyMs: avg('avgLatencyMs'),
      p50LatencyMs: avg('p50LatencyMs'),
      p95LatencyMs: avg('p95LatencyMs'),
      maxLatencyMs: avg('maxLatencyMs'),
    });
  }
  return buckets;
}

function formatTick(iso, hours) {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function LatencyChart({ colors }) {
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

  const width = 900, height = 200, padLeft = 40, padRight = 12, padTop = 14, padBottom = 24;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const usable = useMemo(
    () => (rows || []).filter((r) => r.p50LatencyMs != null || r.p95LatencyMs != null),
    [rows],
  );

  const { bandPath, linePath, points, maxY, periodStats } = useMemo(() => {
    if (usable.length < 2) return { bandPath: null, linePath: null, points: [], maxY: 50, periodStats: null };

    const maxObserved = Math.max(...usable.map((r) => r.p95LatencyMs ?? r.p50LatencyMs ?? 0));
    const maxY = Math.max(20, maxObserved * 1.2);
    const stepX = innerW / (usable.length - 1);
    const yFor = (v) => padTop + innerH - (Math.min(v, maxY) / maxY) * innerH;
    const xFor = (i) => padLeft + i * stepX;

    const pts = usable.map((r, i) => ({
      x: xFor(i), row: r,
      yP50: r.p50LatencyMs != null ? yFor(r.p50LatencyMs) : null,
      yP95: r.p95LatencyMs != null ? yFor(r.p95LatencyMs) : null,
    }));

    const withBand = pts.filter((p) => p.yP50 != null && p.yP95 != null);
    const bandPath = withBand.length >= 2
      ? `M${withBand.map((p) => `${p.x.toFixed(1)},${p.yP95.toFixed(1)}`).join(' L')} L${[...withBand].reverse().map((p) => `${p.x.toFixed(1)},${p.yP50.toFixed(1)}`).join(' L')} Z`
      : null;

    const withP50 = pts.filter((p) => p.yP50 != null);
    const linePath = withP50.length >= 2
      ? `M${withP50.map((p) => `${p.x.toFixed(1)},${p.yP50.toFixed(1)}`).join(' L')}`
      : null;

    const p95s = usable.map((r) => r.p95LatencyMs).filter((v) => v != null);
    const avgs = usable.map((r) => r.avgLatencyMs).filter((v) => v != null);
    const periodStats = {
      p95: p95s.length > 0 ? p95s.reduce((a, b) => a + b, 0) / p95s.length : null,
      avg: avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
    };

    return { bandPath, linePath, points: pts, maxY, periodStats };
  }, [usable, innerW, innerH]);

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
          Latência da rede
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
          <span style={{ width: 16, height: 3, borderRadius: 2, background: colors.primary }} /> Mediana
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
          <span style={{ width: 16, height: 9, borderRadius: 2, background: `${colors.primary}30`, border: `1px solid ${colors.primary}55` }} /> Faixa até o p95 (picos)
        </span>
        {periodStats?.avg != null && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: colors.textTertiary }}>
            Média do período: <strong style={{ color: colors.textPrimary }}>{periodStats.avg.toFixed(0)} ms</strong>
            {' · '}p95: <strong style={{ color: colors.textPrimary }}>{periodStats.p95?.toFixed(0)} ms</strong>
          </span>
        )}
      </div>

      {!rows && <div style={{ fontSize: 13, color: colors.textSecondary, padding: '30px 0', textAlign: 'center' }}>Carregando histórico...</div>}
      {rows && usable.length < 2 && <div style={{ fontSize: 13, color: colors.textSecondary, padding: '30px 0', textAlign: 'center' }}>Ainda não há histórico de latência suficiente neste período — volte em algumas rodadas de monitoramento.</div>}

      {usable.length >= 2 && (
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
            <text x={4} y={padTop + 4} fontSize={9} fill={colors.textTertiary}>{Math.round(maxY)} ms</text>
            <text x={4} y={padTop + innerH + 4} fontSize={9} fill={colors.textTertiary}>0 ms</text>

            {bandPath && <path d={bandPath} fill={colors.primary} opacity={0.16} />}
            {linePath && <path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}

            {[0, points.length - 1].map((i) => (
              <text key={i} x={points[i].x} y={height - 6} fontSize={9} fill={colors.textTertiary} textAnchor={i === 0 ? 'start' : 'end'}>
                {formatTick(points[i].row.at, range.hours)}
              </text>
            ))}

            {hover && (
              <line x1={hover.x} x2={hover.x} y1={padTop} y2={padTop + innerH} stroke={colors.textTertiary} strokeWidth={1} strokeDasharray="3,3" />
            )}
            {hover?.yP50 != null && <circle cx={hover.x} cy={hover.yP50} r={3.5} fill={colors.primary} />}
          </svg>

          {hover && (
            <div style={{
              position: 'absolute', left: `${Math.min(78, Math.max(2, (hover.x / width) * 100))}%`, top: 4,
              background: colors.bgCardAlt, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '8px 10px',
              fontSize: 11.5, color: colors.textPrimary, boxShadow: colors.shadow, pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              <div style={{ color: colors.textTertiary, marginBottom: 4 }}>{new Date(hover.row.at).toLocaleString('pt-BR')}</div>
              {hover.row.p50LatencyMs != null && <div style={{ color: colors.textPrimary, fontWeight: 700 }}>Mediana: {hover.row.p50LatencyMs.toFixed(0)} ms</div>}
              {hover.row.p95LatencyMs != null && <div style={{ color: colors.textSecondary }}>p95: {hover.row.p95LatencyMs.toFixed(0)} ms</div>}
              {hover.row.maxLatencyMs != null && <div style={{ color: colors.textSecondary }}>Máxima: {hover.row.maxLatencyMs.toFixed(0)} ms</div>}
              {hover.row.avgLatencyMs != null && <div style={{ color: colors.textTertiary, marginTop: 2 }}>Média: {hover.row.avgLatencyMs.toFixed(0)} ms</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
