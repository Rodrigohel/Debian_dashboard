import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const PERIODS = [
  { key: 30, label: '30 dias' },
  { key: 90, label: '90 dias' },
];

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAY_ROWS = ['D', '', 'T', '', 'Q', '', 'S']; // dom/ter/qui/sáb visíveis, o resto em branco (evita poluição)

function bucketStyle(colors, pct) {
  if (pct == null) return { bg: colors.bgCardAlt, ring: colors.border };
  if (pct >= 99.95) return { bg: colors.green, ring: colors.green };
  if (pct >= 99) return { bg: `${colors.green}66`, ring: `${colors.green}66` };
  if (pct >= 95) return { bg: `${colors.amber}70`, ring: `${colors.amber}70` };
  if (pct >= 80) return { bg: `${colors.red}70`, ring: `${colors.red}70` };
  return { bg: colors.red, ring: colors.red };
}

const LEGEND = [
  { pct: null, label: 'Sem dados' },
  { pct: 100, label: '100%' },
  { pct: 99, label: '≥ 99%' },
  { pct: 95, label: '≥ 95%' },
  { pct: 80, label: '≥ 80%' },
  { pct: 0, label: '< 80%' },
];

// Mapa de calor de disponibilidade, estilo "GitHub contributions": cada
// coluna é uma semana, cada célula um dia — dá pra enxergar de longe padrões
// que um número sozinho esconde (ex.: um NVR que sempre degrada de
// madrugada, ou uma queda isolada há 3 semanas que ainda pesa na média).
export default function UptimeHeatmap({ colors, deviceId }) {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    api.deviceUptimeHeatmap(deviceId, days).then((res) => { if (!cancelled) setData(res.data); });
    return () => { cancelled = true; };
  }, [deviceId, days]);

  const { weeks, monthMarks } = useMemo(() => {
    if (!data) return { weeks: [], monthMarks: [] };
    const firstWeekday = new Date(`${data[0].date}T00:00:00Z`).getUTCDay();
    const padded = [...Array(firstWeekday).fill(null), ...data];
    const weeks = [];
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

    const monthMarks = weeks.map((week) => {
      const firstDayOfMonth = week.find((d) => d && new Date(`${d.date}T00:00:00Z`).getUTCDate() === 1);
      if (!firstDayOfMonth) return '';
      return MONTH_ABBR[new Date(`${firstDayOfMonth.date}T00:00:00Z`).getUTCMonth()];
    });
    return { weeks, monthMarks };
  }, [data]);

  const cell = 11, gap = 3;

  return (
    <div style={{ background: colors.bgCardAlt, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em' }}>Disponibilidade por dia</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setDays(p.key)}
              style={{
                border: `1px solid ${days === p.key ? colors.primary : colors.border}`,
                background: days === p.key ? `${colors.primary}1A` : colors.bgCard,
                color: days === p.key ? colors.primary : colors.textSecondary,
                borderRadius: 99, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data && <div style={{ fontSize: 12.5, color: colors.textTertiary, padding: '8px 0' }}>Carregando...</div>}

      {data && (
        <div style={{ position: 'relative', overflowX: 'auto' }}>
          <div style={{ display: 'inline-flex', gap, paddingLeft: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 2 }}>
              {WEEKDAY_ROWS.map((label, i) => (
                <div key={i} style={{ width: 10, height: cell, fontSize: 8, color: colors.textTertiary, display: 'flex', alignItems: 'center' }}>{label}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
                <div style={{ height: 11, fontSize: 8.5, color: colors.textTertiary, whiteSpace: 'nowrap' }}>{monthMarks[wi]}</div>
                {week.map((day, di) => {
                  const style = bucketStyle(colors, day?.uptimePercent);
                  return (
                    <div
                      key={di}
                      onMouseEnter={() => day && setHover({ ...day, wi, di })}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        width: cell, height: cell, borderRadius: 3, background: style.bg,
                        border: `1px solid ${style.ring}`, cursor: day ? 'pointer' : 'default',
                        visibility: day ? 'visible' : 'hidden',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {hover && (
            <div style={{
              position: 'absolute', left: 16 + hover.wi * (cell + gap), top: -34,
              background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '5px 9px',
              fontSize: 11, color: colors.textPrimary, boxShadow: colors.shadow, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1,
            }}>
              <strong>{new Date(`${hover.date}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
              {' — '}
              {hover.uptimePercent != null ? `${hover.uptimePercent}% uptime` : 'sem dados'}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {LEGEND.map((l) => {
          const style = bucketStyle(colors, l.pct);
          return (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: colors.textTertiary }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: style.bg, border: `1px solid ${style.ring}` }} />
              {l.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
