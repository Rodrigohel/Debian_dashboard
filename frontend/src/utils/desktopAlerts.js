const STORAGE_KEY = 'ip_dashboard_desktop_alerts';

export function isDesktopAlertsEnabled() {
  return localStorage.getItem(STORAGE_KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function enableDesktopAlerts() {
  if (typeof Notification === 'undefined') return false;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission === 'granted') {
    localStorage.setItem(STORAGE_KEY, '1');
    return true;
  }
  localStorage.setItem(STORAGE_KEY, '0');
  return false;
}

export function disableDesktopAlerts() {
  localStorage.setItem(STORAGE_KEY, '0');
}

// Bipe curto sintetizado via Web Audio — sem depender de nenhum arquivo de
// áudio (o painel roda offline, numa rede interna). Dois tons rápidos, tipo
// alerta de monitoramento, não uma campainha musical.
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.15);
    });
    setTimeout(() => ctx.close(), 500);
  } catch {
    // navegador sem suporte a Web Audio — silenciosamente ignora
  }
}

// Dispara notificação desktop (mesmo com a aba minimizada) + som — chamado
// quando o WebSocket detecta que um dispositivo acabou de ficar offline.
export function fireDesktopAlert(title, body) {
  if (!isDesktopAlertsEnabled()) return;
  playBeep();
  try {
    new Notification(title, { body, tag: title });
  } catch {
    // alguns navegadores lançam se a página não está numa aba visível de
    // forma inesperada — o som já disparou, não é crítico perder a notificação
  }
}
