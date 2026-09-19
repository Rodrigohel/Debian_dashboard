import Icon, { ICONS } from './Icon.jsx';

export default function HeroBanner({ colors, banner }) {
  return (
    <div style={{
      background: banner.gradient, border: `1px solid ${banner.border}`, borderRadius: 18, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16, boxShadow: colors.shadow, animation: 'fadeInUp .4s ease both',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 99, background: banner.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: `0 6px 16px -4px ${banner.iconBg}`,
        animation: banner.urgent ? 'pulseRing 1.8s ease-out infinite' : 'none',
      }}>
        <Icon paths={banner.iconPaths} size={21} color={banner.iconColor} strokeWidth={2.4} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary, fontFamily: "'Space Grotesk',sans-serif" }}>{banner.title}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>{banner.subtitle}</div>
      </div>
    </div>
  );
}

export function buildHeroBanner(colors, { summary, activeAlertsCount }) {
  if (summary.offline > 0) {
    return {
      gradient: `linear-gradient(135deg, ${colors.redSoft} 0%, transparent 100%)`, border: 'transparent',
      iconBg: colors.red, iconColor: '#fff', iconPaths: ICONS.offline, urgent: true,
      title: `${summary.offline} dispositivo${summary.offline > 1 ? 's' : ''} sem conexão`,
      subtitle: `${summary.online} de ${summary.total} online · ${summary.degraded} degradado(s) · ${activeAlertsCount} alerta(s) ativo(s)`,
    };
  }
  if (summary.degraded > 0 || activeAlertsCount > 0) {
    return {
      gradient: `linear-gradient(135deg, ${colors.amberSoft} 0%, transparent 100%)`, border: 'transparent',
      iconBg: colors.amber, iconColor: '#fff', iconPaths: ICONS.warningTriangle, urgent: false,
      title: 'Atenção necessária',
      subtitle: `${summary.online} de ${summary.total} dispositivos online · ${summary.degraded} degradado(s) · ${activeAlertsCount} alerta(s) para revisar`,
    };
  }
  return {
    gradient: `linear-gradient(135deg, ${colors.greenSoft} 0%, transparent 100%)`, border: 'transparent',
    iconBg: colors.green, iconColor: '#fff', iconPaths: ICONS.check, urgent: false,
    title: 'Toda a rede está online',
    subtitle: `${summary.online} de ${summary.total} dispositivos monitorados respondendo normalmente`,
  };
}
