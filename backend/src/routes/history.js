import { Router } from 'express';
import { getEventsHistory } from '../services/eventsService.js';

export const historyRouter = Router();

historyRouter.get('/', (req, res) => {
  const { deviceId, eventType, from, to, limit } = req.query;
  res.json({
    data: getEventsHistory({
      deviceId: deviceId ? Number(deviceId) : undefined,
      eventType: eventType || undefined,
      from: from || undefined,
      to: to || undefined,
      limit,
    }),
  });
});
