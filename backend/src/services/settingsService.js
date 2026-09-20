import { db } from '../db/sqlite.js';
import { config } from '../config.js';

const upsertStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const selectStmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);

const DEFAULTS = {
  companyName: process.env.DEFAULT_COMPANY_NAME || 'Minha Empresa',
  siteName: process.env.DEFAULT_SITE_NAME || 'Monitoramento de Rede',
  logoUrl: '',
  floorPlanUrl: '',
  pingIntervalSeconds: String(config.monitor.pingIntervalSeconds),
  pingTimeoutMs: String(config.monitor.pingTimeoutMs),
  offlineThresholdFails: String(config.monitor.offlineThresholdFails),
  networkBase: config.networkBase,
  networkHistoryRetentionHours: String(process.env.NETWORK_HISTORY_RETENTION_HOURS || 168),
  alertReminderIntervalMinutes: String(process.env.ALERT_REMINDER_INTERVAL_MINUTES || 60),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  // 'off' | 'weekly' | 'monthly' — envia o relatório executivo em PDF
  // automaticamente pelo Telegram já configurado (ver executiveReportScheduler).
  executiveReportFrequency: process.env.EXECUTIVE_REPORT_FREQUENCY || 'off',
  // Bookkeeping interno do agendador — não editável pela tela de Configurações.
  executiveReportLastSentAt: '',
};

const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));

export function getSettings() {
  const result = { ...DEFAULTS };
  for (const key of ALLOWED_KEYS) {
    const row = selectStmt.get(key);
    if (row && row.value) result[key] = row.value;
  }
  return result;
}

export function setSettings(partial) {
  for (const [key, value] of Object.entries(partial)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    upsertStmt.run(key, String(value ?? ''));
  }
  return getSettings();
}
