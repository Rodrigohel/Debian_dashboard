import Icon, { ICONS } from './Icon.jsx';

const NO_LOCATION = 'Sem local definido';

function groupByLocation(devices) {
  const groups = new Map();
  for (const d of devices) {
    if (!d.enabled) continue;
    const key = d.location?.trim() || NO_LOCATION;
    const g = groups.get(key) || { total: 0, online: 0, offline: 0, degraded: 0, unknown: 0 };
    g.total += 1;
    g[d.status] = (g[d.status] || 0) + 1;
    groups.set(key, g);
  }
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === NO_LOCATION) return 1;
    if (b[0] === NO_LOCATION) return -1;
    return b[1].offline - a[1].offline || b[1].degraded - a[1].degraded || a[0].localeCompare(b[0]);
  });
}

// Saúde agrupada por local (bloco, portaria, garagem...) em vez de por tipo
// de equipamento — quando o problema é elétrico ou de rede de um setor
// inteiro, ver "Bloco B: 4 offline" é mais direto do que vasculhar por tipo.
export default function LocationHealthPanel({ colors, devices }) {
  const groups = groupByLocation(devices);
  if (groups.length === 0) return null;

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon paths={ICONS.network} size={15} strokeWidth={2.2} color={colors.textSecondary} />
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Saúde por local</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
        {groups.map(([location, s]) => {
          const healthy = s.offline === 0 && s.degraded === 0;
          return (
            <div key={location} style={{
              border: `1px solid ${healthy ? colors.border : s.offline > 0 ? `${colors.red}55` : `${colors.amber}55`}`,
              background: healthy ? colors.bgCardAlt : s.offline > 0 ? `${colors.red}0D` : `${colors.amber}0D`,
              borderRadius: 12, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {location}
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: colors.textSecondary, flexWrap: 'wrap' }}>
                <span style={{ color: colors.green, fontWeight: 700 }}>{s.online || 0} online</span>
                {s.offline > 0 && <span style={{ color: colors.red, fontWeight: 700 }}>{s.offline} offline</span>}
                {s.degraded > 0 && <span style={{ color: colors.amber, fontWeight: 700 }}>{s.degraded} degradado</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
