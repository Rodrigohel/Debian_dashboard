import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { TYPE_META } from './Icon.jsx';

const STATUS_DOT = { online: 'green', offline: 'red', degraded: 'amber', unknown: 'border' };

function RankBadge({ colors, rank }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800, color: colors.textTertiary, background: colors.bgCardAlt, border: `1px solid ${colors.border}`,
    }}>
      {rank}
    </div>
  );
}

function DeviceRow({ colors, device, trailing }) {
  const meta = TYPE_META[device.type] || TYPE_META.outro;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
      <Icon paths={meta.icon} size={14} strokeWidth={2} color={colors.textTertiary} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.name}</div>
        <div style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'monospace' }}>{device.ip}</div>
      </div>
      {trailing}
    </div>
  );
}

function Card({ colors, title, icon, children }) {
  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: colors.shadow, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon paths={icon} size={15} strokeWidth={2.2} color={colors.textSecondary} />
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

// "Destaques" da rede: em ~230 dispositivos, quase sempre é um punhado deles
// respondendo pela maior parte dos problemas — em vez de vasculhar a lista
// inteira, esses dois rankings já apontam direto pra onde olhar.
export default function TopIssues({ colors, devices, icons }) {
  const [flappy, setFlappy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api.flappiestDevices(24, 5).then((res) => { if (!cancelled) setFlappy(res.data); }).catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const slowest = devices
    .filter((d) => d.enabled && d.latencyMs != null && (d.status === 'online' || d.status === 'degraded'))
    .sort((a, b) => b.latencyMs - a.latencyMs)
    .slice(0, 5);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(360px,100%),1fr))', gap: 16 }}>
      <Card colors={colors} title="Mais instáveis (24h)" icon={icons.warningTriangle}>
        {flappy === null && <div style={{ fontSize: 12.5, color: colors.textTertiary, padding: '10px 0' }}>Carregando...</div>}
        {flappy?.length === 0 && (
          <div style={{ fontSize: 12.5, color: colors.textTertiary, padding: '10px 0' }}>Nenhuma queda registrada nas últimas 24h — rede estável. 🎉</div>
        )}
        {flappy?.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RankBadge colors={colors} rank={i + 1} />
            <DeviceRow
              colors={colors}
              device={d}
              trailing={(
                <span style={{ fontSize: 11.5, fontWeight: 800, color: colors.red, background: `${colors.red}18`, borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                  {d.drops}× caiu
                </span>
              )}
            />
          </div>
        ))}
      </Card>

      <Card colors={colors} title="Maior latência agora" icon={icons.clock}>
        {slowest.length === 0 && (
          <div style={{ fontSize: 12.5, color: colors.textTertiary, padding: '10px 0' }}>Sem dados de latência no momento.</div>
        )}
        {slowest.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RankBadge colors={colors} rank={i + 1} />
            <DeviceRow
              colors={colors}
              device={d}
              trailing={(
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: colors[STATUS_DOT[d.status]] }} />
                  {d.latencyMs.toFixed(0)} ms
                </span>
              )}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
