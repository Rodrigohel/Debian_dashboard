import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}min`;
}

function Bar({ colors, label, valueLabel, percent, color }) {
  const level = percent >= 90 ? colors.red : percent >= 75 ? colors.amber : color;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: colors.textSecondary, fontWeight: 600 }}>{label}</span>
        <span style={{ color: colors.textPrimary, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{valueLabel}</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: colors.bgCardAlt, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', borderRadius: 99, background: level, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}

export default function ServerHealthPanel({ colors }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    function load() { api.serverHealth().then((h) => { if (!cancelled) setHealth(h); }).catch(() => {}); }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!health) {
    return (
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 12 }}>Servidor</div>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Servidor</div>
        <div style={{ fontSize: 11.5, color: colors.textTertiary }}>{health.hostname}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Bar colors={colors} label={`CPU (${health.cpuCount} núcleos)`} valueLabel={`${health.loadPercent}%`} percent={health.loadPercent} color={colors.primary} />
        <Bar colors={colors} label="Memória" valueLabel={`${health.memory.usedGb} / ${health.memory.totalGb} GB`} percent={health.memory.usedPercent} color={colors.primary} />
        {health.disk && (
          <Bar colors={colors} label="Disco (/)" valueLabel={`${health.disk.usedGb} / ${health.disk.totalGb} GB`} percent={health.disk.usedPercent} color={colors.primary} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.border}`, fontSize: 12 }}>
        <div>
          <div style={{ color: colors.textTertiary }}>Load average</div>
          <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{health.loadAverage['1m']} / {health.loadAverage['5m']} / {health.loadAverage['15m']}</div>
        </div>
        <div>
          <div style={{ color: colors.textTertiary }}>No ar há</div>
          <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{formatUptime(health.systemUptimeSeconds)}</div>
        </div>
      </div>
    </div>
  );
}
