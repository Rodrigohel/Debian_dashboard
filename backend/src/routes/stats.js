import { Router } from 'express';
import { getNetworkHistory } from '../services/networkHistoryService.js';
import { getServerHealth } from '../services/systemHealthService.js';
import { getFlappiestDevices } from '../services/eventsService.js';

export const statsRouter = Router();

statsRouter.get('/network-history', (req, res) => {
  const hours = Math.min(Number(req.query.hours) || 24, 24 * 30);
  res.json({ data: getNetworkHistory(hours) });
});

statsRouter.get('/server-health', async (req, res) => {
  res.json(await getServerHealth());
});

statsRouter.get('/flappiest', (req, res) => {
  const hours = Math.min(Number(req.query.hours) || 24, 24 * 30);
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  res.json({ data: getFlappiestDevices(hours, limit) });
});
