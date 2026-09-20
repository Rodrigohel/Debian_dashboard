import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';
import { isDesktopAlertsEnabled, enableDesktopAlerts, disableDesktopAlerts } from '../utils/desktopAlerts.js';
import { showToast } from '../utils/toast.js';

function IconToggle({ colors, active, onClick, iconOn, iconOff, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8,
        border: `1px solid ${active ? colors.primary : colors.border}`, background: active ? `${colors.primary}18` : 'transparent',
        color: active ? colors.primary : colors.textTertiary, cursor: 'pointer',
      }}
    >
      <Icon paths={active ? iconOn : iconOff} size={13} strokeWidth={2.2} />
    </button>
  );
}

export default function TopBar({ colors, monitoring, onEnterTvMode }) {
  const [alertsOn, setAlertsOn] = useState(isDesktopAlertsEnabled());

  async function handleToggleAlerts() {
    if (alertsOn) {
      disableDesktopAlerts();
      setAlertsOn(false);
      showToast('Notificações desktop desativadas.', 'info');
    } else {
      const granted = await enableDesktopAlerts();
      setAlertsOn(granted);
      showToast(granted ? 'Notificações desktop ativadas — você será avisado mesmo com a aba minimizada.' : 'Permissão de notificação negada pelo navegador.', granted ? 'success' : 'error');
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 600, color: colors.textTertiary, letterSpacing: '.02em' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: monitoring ? colors.green : colors.amber }} />
        {monitoring ? 'Monitoramento ativo — verificando os dispositivos em tempo real' : 'Aguardando primeira verificação...'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconToggle colors={colors} active={alertsOn} onClick={handleToggleAlerts} iconOn={ICONS.bell} iconOff={ICONS.bellOff} title={alertsOn ? 'Notificações desktop ativadas — clique pra desativar' : 'Ativar notificações desktop (som + alerta mesmo com a aba minimizada)'} />
        {onEnterTvMode && (
          <IconToggle colors={colors} active={false} onClick={onEnterTvMode} iconOn={ICONS.tv} iconOff={ICONS.tv} title="Modo TV — tela cheia, alternando painéis automaticamente" />
        )}
      </div>
    </div>
  );
}
