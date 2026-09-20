import { getSettings, setSettings } from './settingsService.js';
import { generateExecutiveReportBuffer } from './executiveReportService.js';
import { sendTelegramDocumentWith } from './telegramService.js';

const FREQUENCY_MS = { weekly: 7 * 86400000, monthly: 30 * 86400000 };
const FREQUENCY_DAYS = { weekly: 7, monthly: 30 };
const CHECK_INTERVAL_MS = 3600000; // checa 1x por hora — não precisa de precisão ao minuto

async function checkAndSend() {
  const settings = getSettings();
  const frequency = settings.executiveReportFrequency;
  if (frequency !== 'weekly' && frequency !== 'monthly') return;
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

  const lastSent = settings.executiveReportLastSentAt ? new Date(settings.executiveReportLastSentAt).getTime() : 0;
  const dueMs = FREQUENCY_MS[frequency];
  if (Date.now() - lastSent < dueMs) return;

  try {
    const days = FREQUENCY_DAYS[frequency];
    const buffer = await generateExecutiveReportBuffer(days);
    const caption = `📊 Relatório executivo automático (${frequency === 'weekly' ? 'semanal' : 'mensal'}) — ${settings.siteName}`;
    const result = await sendTelegramDocumentWith(settings.telegramBotToken, settings.telegramChatId, buffer, `relatorio-executivo-${days}d.pdf`, caption);
    if (result.ok) {
      setSettings({ executiveReportLastSentAt: new Date().toISOString() });
    } else {
      console.error('[executive-report] falha ao enviar relatório automático:', result.error);
    }
  } catch (err) {
    console.error('[executive-report] erro ao gerar/enviar relatório automático:', err.message);
  }
}

// Agendador simples de "relatório executivo por Telegram": em vez de um cron
// exato (dia/hora fixos), checa a cada hora se já passou tempo suficiente
// desde o último envio — mais simples e resiliente a reinícios do backend
// (não perde o envio se o processo estiver fora do ar na hora exata).
export function startExecutiveReportScheduler() {
  checkAndSend();
  setInterval(checkAndSend, CHECK_INTERVAL_MS);
}
