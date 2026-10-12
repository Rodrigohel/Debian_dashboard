import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { getSettings, setSettings } from '../services/settingsService.js';
import { sendTelegramMessageWith } from '../services/telegramService.js';
import { makeTwilioCallsWith, parsePhoneNumbers } from '../services/twilioService.js';
import { logAudit } from '../services/auditService.js';

export const settingsRouter = Router();

const uploadsDir = path.resolve('data/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Envie um arquivo de imagem (PNG, JPG ou SVG).'));
      return;
    }
    cb(null, true);
  },
});

settingsRouter.get('/', (req, res) => {
  res.json(getSettings());
});

settingsRouter.put('/', (req, res) => {
  const {
    companyName, siteName, pingIntervalSeconds, pingTimeoutMs, offlineThresholdFails, alertReminderIntervalMinutes,
    alertReminderIntervalMinutesCritical,
    networkBase, networkHistoryRetentionHours, telegramBotToken, telegramChatId, telegramChatIdCritical, executiveReportFrequency,
    backupEnabled, backupRetentionDays, loginMaxAttempts, loginAttemptWindowMinutes, loginLockoutMinutes,
    heartbeatEnabled, heartbeatFrequencyHours,
    twilioCallEnabled, twilioAccountSid, twilioAuthToken, twilioFromNumber, twilioToNumberCritical, twilioCallReminderIntervalMinutes,
  } = req.body || {};
  const updates = {};

  if (typeof companyName === 'string' && companyName.trim()) updates.companyName = companyName.trim();
  if (typeof siteName === 'string' && siteName.trim()) updates.siteName = siteName.trim();

  if (pingIntervalSeconds !== undefined) {
    const n = Number(pingIntervalSeconds);
    if (!Number.isFinite(n) || n < 5) return res.status(400).json({ error: 'Intervalo entre verificações deve ser de pelo menos 5 segundos.' });
    updates.pingIntervalSeconds = n;
  }

  if (pingTimeoutMs !== undefined) {
    const n = Number(pingTimeoutMs);
    if (!Number.isFinite(n) || n < 200) return res.status(400).json({ error: 'Timeout deve ser de pelo menos 200ms.' });
    updates.pingTimeoutMs = n;
  }

  if (offlineThresholdFails !== undefined) {
    const n = Number(offlineThresholdFails);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Falhas seguidas para marcar offline deve ser pelo menos 1.' });
    updates.offlineThresholdFails = n;
  }

  if (alertReminderIntervalMinutes !== undefined) {
    const n = Number(alertReminderIntervalMinutes);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Intervalo de lembrete (equipamento normal) deve ser um número de minutos (0 desativa).' });
    updates.alertReminderIntervalMinutes = n;
  }

  if (alertReminderIntervalMinutesCritical !== undefined) {
    const n = Number(alertReminderIntervalMinutesCritical);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Intervalo de lembrete (equipamento crítico) deve ser um número de minutos (0 desativa).' });
    updates.alertReminderIntervalMinutesCritical = n;
  }

  if (networkBase !== undefined) {
    // Aceita vários prefixos separados por vírgula (ex.: "192.168.1,192.168.20")
    // pra quem tem a rede segmentada em VLANs/sub-redes diferentes — o
    // "Escanear rede" varre todos de uma vez (ver scanService).
    const parts = String(networkBase).split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0 || !parts.every((p) => /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p))) {
      return res.status(400).json({ error: 'Prefixo de rede inválido — use o formato 192.168.1 (3 primeiros números do IP), ou vários separados por vírgula: 192.168.1,192.168.20' });
    }
    updates.networkBase = parts.join(',');
  }

  if (networkHistoryRetentionHours !== undefined) {
    const n = Number(networkHistoryRetentionHours);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Retenção do histórico deve ser de pelo menos 1 hora.' });
    updates.networkHistoryRetentionHours = n;
  }

  if (typeof telegramBotToken === 'string') updates.telegramBotToken = telegramBotToken.trim();
  if (typeof telegramChatId === 'string') updates.telegramChatId = telegramChatId.trim();
  if (typeof telegramChatIdCritical === 'string') updates.telegramChatIdCritical = telegramChatIdCritical.trim();

  if (executiveReportFrequency !== undefined) {
    if (!['off', 'weekly', 'monthly'].includes(executiveReportFrequency)) {
      return res.status(400).json({ error: 'Frequência do relatório executivo inválida.' });
    }
    updates.executiveReportFrequency = executiveReportFrequency;
  }

  if (backupEnabled !== undefined) updates.backupEnabled = backupEnabled ? 'true' : 'false';

  if (backupRetentionDays !== undefined) {
    const n = Number(backupRetentionDays);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Retenção de backups deve ser de pelo menos 1 dia.' });
    updates.backupRetentionDays = n;
  }

  if (loginMaxAttempts !== undefined) {
    const n = Number(loginMaxAttempts);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Tentativas máximas de login deve ser pelo menos 1.' });
    updates.loginMaxAttempts = n;
  }

  if (loginAttemptWindowMinutes !== undefined) {
    const n = Number(loginAttemptWindowMinutes);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Janela de tentativas de login deve ser de pelo menos 1 minuto.' });
    updates.loginAttemptWindowMinutes = n;
  }

  if (loginLockoutMinutes !== undefined) {
    const n = Number(loginLockoutMinutes);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Duração do bloqueio de login deve ser de pelo menos 1 minuto.' });
    updates.loginLockoutMinutes = n;
  }

  if (heartbeatEnabled !== undefined) updates.heartbeatEnabled = heartbeatEnabled ? 'true' : 'false';

  if (heartbeatFrequencyHours !== undefined) {
    const n = Number(heartbeatFrequencyHours);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Frequência do heartbeat deve ser de pelo menos 1 hora.' });
    updates.heartbeatFrequencyHours = n;
  }

  if (twilioCallEnabled !== undefined) updates.twilioCallEnabled = twilioCallEnabled ? 'true' : 'false';
  if (typeof twilioAccountSid === 'string') updates.twilioAccountSid = twilioAccountSid.trim();
  if (typeof twilioAuthToken === 'string') updates.twilioAuthToken = twilioAuthToken.trim();

  const E164 = /^\+[1-9]\d{6,14}$/;
  if (typeof twilioFromNumber === 'string') {
    const v = twilioFromNumber.trim();
    if (v && !E164.test(v)) return res.status(400).json({ error: 'Número de origem Twilio inválido — use o formato internacional E.164, ex.: +14155551234.' });
    updates.twilioFromNumber = v;
  }
  if (typeof twilioToNumberCritical === 'string') {
    // Aceita um ou vários números separados por vírgula — cada um recebe sua
    // própria ligação em paralelo quando um equipamento crítico cai (ver
    // twilioService.makeTwilioCallsWith).
    const numbers = parsePhoneNumbers(twilioToNumberCritical);
    if (!numbers.every((n) => E164.test(n))) {
      return res.status(400).json({ error: 'Número a ligar (crítico) inválido — use o formato internacional E.164 (ex.: +5511987654321), um ou vários separados por vírgula.' });
    }
    updates.twilioToNumberCritical = numbers.join(',');
  }

  if (twilioCallReminderIntervalMinutes !== undefined) {
    const n = Number(twilioCallReminderIntervalMinutes);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Intervalo de ligação repetida deve ser um número de minutos (0 liga só uma vez).' });
    updates.twilioCallReminderIntervalMinutes = n;
  }

  const result = setSettings(updates);
  logAudit({ username: req.user?.username, action: 'settings.update', details: `Configurações atualizadas (${Object.keys(updates).join(', ') || 'nenhum campo'})` });
  res.json(result);
});

settingsRouter.post('/telegram/test', async (req, res) => {
  const current = getSettings();
  const botToken = String(req.body?.telegramBotToken ?? current.telegramBotToken ?? '').trim();
  const chatId = String(req.body?.telegramChatId ?? current.telegramChatId ?? '').trim();

  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'Preencha o Bot Token e o Chat ID antes de testar.' });
  }

  const result = await sendTelegramMessageWith(
    botToken, chatId,
    '🔔 Teste do painel de rede — se você recebeu esta mensagem, a notificação está configurada corretamente!',
  );
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

settingsRouter.post('/twilio/test', async (req, res) => {
  const current = getSettings();
  const accountSid = String(req.body?.twilioAccountSid ?? current.twilioAccountSid ?? '').trim();
  const authToken = String(req.body?.twilioAuthToken ?? current.twilioAuthToken ?? '').trim();
  const fromNumber = String(req.body?.twilioFromNumber ?? current.twilioFromNumber ?? '').trim();
  const toNumbers = String(req.body?.twilioToNumberCritical ?? current.twilioToNumberCritical ?? '').trim();

  if (!accountSid || !authToken || !fromNumber || !toNumbers) {
    return res.status(400).json({ error: 'Preencha Account SID, Auth Token, número de origem e ao menos um número a ligar antes de testar.' });
  }

  // Testa TODOS os números configurados (não só o primeiro) — assim o
  // administrador descobre na hora se algum número da lista está errado.
  const results = await makeTwilioCallsWith(accountSid, authToken, fromNumber, toNumbers);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return res.status(400).json({ error: failed.map((r) => `${r.toNumber}: ${r.error}`).join(' | ') });
  }
  res.json({ ok: true, calledNumbers: results.map((r) => r.toNumber) });
});

settingsRouter.post('/logo', (req, res) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const logoUrl = `/api/uploads/${req.file.filename}`;
    res.json(setSettings({ logoUrl }));
  });
});
