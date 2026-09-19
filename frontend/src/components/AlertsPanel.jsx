import Icon, { ICONS } from './Icon.jsx';

const SEVERITY_META = {
  critical: { label: 'Crítico', iconBg: 'redSoft', iconColor: 'red', iconPaths: ICONS.warningTriangle },
  warning: { label: 'Atenção', iconBg: 'amberSoft', iconColor: 'amber', iconPaths: ICONS.warningTriangle },
  info: { label: 'Informação', iconBg: 'primarySoft', iconColor: 'primary', iconPaths: ICONS.info },
  resolved: { label: 'Resolvido', iconBg: 'greenSoft', iconColor: 'green', iconPaths: ICONS.check },
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function AlertRow({ colors, alert }) {
  const resolved = alert.status === 'resolved';
  const meta = resolved ? SEVERITY_META.resolved : (SEVERITY_META[alert.severity] || SEVERITY_META.info);
  const iconColor = colors[meta.iconColor];
  const iconBg = colors[meta.iconBg];

  return (
    <div style={{
      display: 'flex', gap: 12, padding: 12, borderRadius: 12,
      background: resolved ? 'transparent' : colors.bgCardAlt,
      border: `1px solid ${resolved ? 'transparent' : colors.border}`,
      opacity: resolved ? 0.7 : 1,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon paths={meta.iconPaths} size={15} color={iconColor} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.03em', color: iconColor, textTransform: 'uppercase' }}>
            {resolved ? 'Resolvido' : meta.label}
          </span>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>{timeAgo(alert.createdAt)}</span>
        </div>
        <div style={{ fontSize: 13.5, color: resolved ? colors.textSecondary : colors.textPrimary, marginTop: 3 }}>{alert.message}</div>
      </div>
    </div>
  );
}

export default function AlertsPanel({ colors, alerts }) {
  const active = alerts.filter((a) => a.status !== 'resolved');
  const resolved = alerts.filter((a) => a.status === 'resolved').slice(0, 8);

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 12 }}>Alertas recentes</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
        {active.length === 0 && (
          <div style={{ fontSize: 13, color: colors.textSecondary }}>Nenhum alerta ativo no momento.</div>
        )}
        {active.map((alert) => <AlertRow key={alert.id} colors={colors} alert={alert} />)}
      </div>

      {resolved.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textTertiary, margin: '16px 0 8px' }}>
            Resolvidos recentemente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolved.map((alert) => <AlertRow key={alert.id} colors={colors} alert={alert} />)}
          </div>
        </>
      )}
    </div>
  );
}
