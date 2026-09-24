import { Router } from 'express';
import { listAuditLog } from '../services/auditService.js';

export const auditRouter = Router();

auditRouter.get('/', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  res.json(listAuditLog({ limit, offset }));
});
