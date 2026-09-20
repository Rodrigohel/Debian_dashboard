import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { getSettings, setSettings } from '../services/settingsService.js';
import { sendTelegramMessageWith } from '../services/telegramService.js';

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
    networkBase, networkHistoryRetentionHours, telegramBotToken, telegramChatId,
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
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Intervalo de lembrete deve ser um número de minutos (0 desativa).' });
    updates.alertReminderIntervalMinutes = n;
  }

  if (networkBase !== undefined) {
    const value = String(networkBase).trim();
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
      return res.status(400).json({ error: 'Prefixo de rede inválido — use o formato 192.168.1 (3 primeiros números do IP).' });
    }
    updates.networkBase = value;
  }

  if (networkHistoryRetentionHours !== undefined) {
    const n = Number(networkHistoryRetentionHours);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Retenção do histórico deve ser de pelo menos 1 hora.' });
    updates.networkHistoryRetentionHours = n;
  }

  if (typeof telegramBotToken === 'string') updates.telegramBotToken = telegramBotToken.trim();
  if (typeof telegramChatId === 'string') updates.telegramChatId = telegramChatId.trim();

  res.json(setSettings(updates));
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
