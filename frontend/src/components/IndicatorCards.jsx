import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';

function Card({ colors, card, index }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={card.onClick}
      style={{
        position: 'relative', overflow: 'hidden',
        background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 18, padding: '18px 18px 16px',
        boxShadow: hover ? `${colors.shadowHover}, 0 0 0 1px ${card.stateColor}33` : colors.shadow,
        cursor: card.onClick ? 'pointer' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease',
        animation: 'fadeInUp .4s ease both', animationDelay: `${index * 0.05}s`,
        transform: hover ? 'translateY(-5px)' : 'none',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.stateColor, opacity: hover ? 1 : 0.55, transition: 'opacity .18s ease' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, background: card.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: hover ? 'scale(1.06)' : 'none', transition: 'transform .18s ease',
        }}>
          <Icon paths={card.iconPaths} size={20} color={card.iconColor} strokeWidth={2.1} />
        </div>
        {card.onClick && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 4, opacity: hover ? 1 : 0.5, transition: 'opacity .18s ease' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 14, fontWeight: 600 }}>{card.title}</div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 700, color: colors.textPrimary, marginTop: 2, letterSpacing: '-0.01em' }}>{card.value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, fontSize: 12, fontWeight: 600, color: card.stateColor }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: card.stateColor }} />
        {card.stateText}
      </div>
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 6, lineHeight: 1.4 }}>{card.plain}</div>
    </div>
  );
}

export default function IndicatorCards({ colors, cards }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(210px,100%),1fr))', gap: 16 }}>
      {cards.map((card, i) => (
        <Card key={card.title} colors={colors} card={card} index={i} />
      ))}
    </div>
  );
}

export function buildIndicatorCards(colors, data) {
  const { summary, activeAlertsCount, onCardClick = {} } = data;

  return [
    { title: 'Dispositivos monitorados', value: String(summary.total), stateColor: colors.gray, stateText: 'Total cadastrado', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.network, plain: 'Quantidade de equipamentos cadastrados na rede.', onClick: onCardClick.all },
    { title: 'Online', value: String(summary.online), stateColor: colors.green, stateText: 'Respondendo normalmente', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.check, plain: 'Equipamentos com ping e serviços respondendo.', onClick: onCardClick.online },
    { title: 'Offline', value: String(summary.offline), stateColor: colors.red, stateText: 'Sem conexão', iconBg: colors.redSoft, iconColor: colors.red, iconPaths: ICONS.offline, plain: 'Equipamentos sem resposta de ping agora.', onClick: onCardClick.offline },
    { title: 'Degradados', value: String(summary.degraded), stateColor: colors.amber, stateText: 'Ping ok, serviço fora', iconBg: colors.amberSoft, iconColor: colors.amber, iconPaths: ICONS.warningTriangle, plain: 'Respondem ping mas a porta de serviço configurada não responde.', onClick: onCardClick.degraded },
    { title: 'Alertas ativos', value: String(activeAlertsCount), stateColor: activeAlertsCount > 0 ? colors.amber : colors.green, stateText: activeAlertsCount > 0 ? 'Requer atenção' : 'Tudo certo', iconBg: activeAlertsCount > 0 ? colors.amberSoft : colors.greenSoft, iconColor: activeAlertsCount > 0 ? colors.amber : colors.green, iconPaths: ICONS.warningTriangle, plain: 'Avisos de queda/recuperação que precisam da sua atenção.', onClick: onCardClick.alerts },
  ];
}
