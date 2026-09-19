import { Router } from 'express';
import { getAlerts } from '../services/alertsService.js';

export const alertsRouter = Router();

alertsRouter.get('/', (req, res) => {
  res.json({ data: getAlerts() });
});
