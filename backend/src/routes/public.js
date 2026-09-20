import { Router } from 'express';
import { config } from '../config.js';
import { listDevices, getSummary } from '../services/devicesService.js';
import { getAlerts, getActiveAlertsCount } from '../services/alertsService.js';
import { getSettings } from '../services/settingsService.js';

export const publicRouter = Router();

// Nome do condomínio/empresa e logo — usados no cabeçalho antes mesmo do
// login. Só o subconjunto de marca é público; limites de alerta e
// credenciais do Telegram (também guardados em `settings`) exigem login.
publicRouter.get('/settings', (req, res) => {
  const { companyName, siteName, logoUrl } = getSettings();
  res.json({ companyName, siteName, logoUrl });
});

/**
 * Um único payload agregando somente os cards ligados em config.public.cards
 * (ver .env: PUBLIC_SHOW_*). Nenhuma autenticação é exigida nesta rota —
 * qualquer card habilitado aqui fica visível para quem tiver o link.
 */
publicRouter.get('/dashboard', (req, res) => {
  if (!config.public.enabled) {
    return res.status(404).json({ error: 'Painel público desativado' });
  }

  const cards = config.public.cards;
  const payload = { enabledCards: cards };

  let summary = null;
  if (cards.summary || cards.heroBanner || cards.status || cards.typeBreakdown || cards.devicesList) {
    summary = getSummary();
    if (cards.summary) payload.summary = summary;
    if (cards.typeBreakdown) payload.typeBreakdown = summary.byType;
  }

  if (cards.devicesList) {
    payload.devices = listDevices();
  }

  let activeAlertsCount = 0;
  if (cards.alerts || cards.heroBanner) {
    activeAlertsCount = getActiveAlertsCount();
    if (cards.alerts) payload.alerts = getAlerts();
  }

  if (cards.status) {
    payload.status = {
      overall: summary.offline > 0 ? 'degraded' : summary.degraded > 0 ? 'degraded' : 'operational',
    };
  }

  if (cards.heroBanner) {
    payload.heroBanner = { summary, activeAlertsCount };
  }

  res.json(payload);
});
