import { getSettings, setSettings } from './settingsService.js';
import { sendTelegramMessage } from './telegramService.js';
import { getSummary } from './devicesService.js';

const CHECK_INTERVAL_MS = 3600000; // checa 1x por hora, igual aos outros agendadores
const PROCESS_STARTED_AT = Date.now();

// "Quem monitora o monitor": se a própria máquina cair (não só o processo —
// esse caso o systemd já resolve sozinho — mas queda de energia, rede,
// disco), ninguém percebe até alguém abrir o painel manualmente. Uma
// mensagem periódica de "estou vivo" no mesmo Telegram já configurado
// resolve isso sem precisar de infraestrutura externa: se ela parar de
// chegar no horário esperado, é sinal de que o servidor saiu do ar.
async function checkAndSend() {
  const settings = getSettings();
  if (settings.heartbeatEnabled !== 'true') return;
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

  const frequencyMs = (Number(settings.heartbeatFrequencyHours) || 24) * 3600000;
  const lastAt = settings.heartbeatLastSentAt ? new Date(settings.heartbeatLastSentAt).getTime() : 0;
  if (Date.now() - lastAt < frequencyMs) return;

  const summary = getSummary();
  const uptimeHours = ((Date.now() - PROCESS_STARTED_AT) / 3600000).toFixed(1);
  const message = [
    `✅ ${settings.siteName} — painel de rede ativo`,
    `Processo rodando há ${uptimeHours}h.`,
    `${summary.total} dispositivos: ${summary.online} online, ${summary.offline} offline, ${summary.degraded} degradado(s).`,
    '',
    'Se essa mensagem parar de chegar no intervalo configurado, o servidor pode estar fora do ar.',
  ].join('\n');

  await sendTelegramMessage(message);
  setSettings({ heartbeatLastSentAt: new Date().toISOString() });
}

export function startHeartbeatScheduler() {
  checkAndSend();
  setInterval(checkAndSend, CHECK_INTERVAL_MS);
}
