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
  pingIntervalSeconds: String(config.monitor.pingIntervalSeconds),
  pingTimeoutMs: String(config.monitor.pingTimeoutMs),
  offlineThresholdFails: String(config.monitor.offlineThresholdFails),
  networkBase: config.networkBase,
  networkHistoryRetentionHours: String(process.env.NETWORK_HISTORY_RETENTION_HOURS || 168),
  // Lembrete de alerta ainda ativo — equipamento "normal" (não marcado como
  // crítico no cadastro). Equipamento crítico usa o intervalo de baixo,
  // tipicamente mais curto, pra escalar mais rápido.
  alertReminderIntervalMinutes: String(process.env.ALERT_REMINDER_INTERVAL_MINUTES || 60),
  alertReminderIntervalMinutesCritical: String(process.env.ALERT_REMINDER_INTERVAL_MINUTES_CRITICAL || 15),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  // Opcional: além do Chat ID acima, manda os alertas de equipamento crítico
  // TAMBÉM pra esse chat (pessoa, grupo ou canal separado) — pra escalar
  // direto pro responsável de plantão sem depender de alguém ver o grupo
  // geral. Vazio = críticos vão só pro Chat ID principal, igual os outros.
  telegramChatIdCritical: process.env.TELEGRAM_CHAT_ID_CRITICAL || '',
  // 'off' | 'weekly' | 'monthly' — envia o relatório executivo em PDF
  // automaticamente pelo Telegram já configurado (ver executiveReportScheduler).
  executiveReportFrequency: process.env.EXECUTIVE_REPORT_FREQUENCY || 'off',
  // Bookkeeping interno do agendador — não editável pela tela de Configurações.
  executiveReportLastSentAt: '',

  // Backup automático diário do banco (ver backupScheduler) — 'false' desliga.
  backupEnabled: 'true',
  backupRetentionDays: String(process.env.BACKUP_RETENTION_DAYS || 14),
  // Bookkeeping interno do agendador — não editável pela tela de Configurações.
  backupLastAt: '',

  // Bloqueio temporário de login após várias tentativas seguidas (ver
  // loginThrottleService) — janela deslizante em minutos.
  loginMaxAttempts: String(process.env.LOGIN_MAX_ATTEMPTS || 5),
  loginAttemptWindowMinutes: String(process.env.LOGIN_ATTEMPT_WINDOW_MINUTES || 15),
  loginLockoutMinutes: String(process.env.LOGIN_LOCKOUT_MINUTES || 15),

  // "Estou vivo" periódico pelo Telegram já configurado (ver heartbeatScheduler)
  // — desligado por padrão, mesmo comportamento do relatório executivo.
  heartbeatEnabled: 'false',
  heartbeatFrequencyHours: String(process.env.HEARTBEAT_FREQUENCY_HOURS || 24),
  // Bookkeeping interno do agendador — não editável pela tela de Configurações.
  heartbeatLastSentAt: '',
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
