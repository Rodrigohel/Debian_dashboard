import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/sqlite.js';
import { logAudit } from '../services/auditService.js';

export const usersRouter = Router();

const listStmt = db.prepare('SELECT id, username, display_name AS displayName, role, totp_enabled AS totpEnabled, created_at AS createdAt FROM users ORDER BY created_at');
const insertStmt = db.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)');
const getByIdStmt = db.prepare('SELECT username FROM users WHERE id = ?');
const getTotpStmt = db.prepare('SELECT username, totp_enabled AS totpEnabled FROM users WHERE id = ?');
const disableTotpStmt = db.prepare("UPDATE users SET totp_secret = '', totp_enabled = 0, totp_recovery_codes = '[]' WHERE id = ?");
const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM users');

usersRouter.get('/', (req, res) => {
  res.json(listStmt.all());
});

usersRouter.post('/', (req, res) => {
  const { username, displayName, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const finalRole = role === 'admin' ? 'admin' : 'user';
    const info = insertStmt.run(username.trim(), (displayName || username).trim(), hash, finalRole);
    logAudit({ username: req.user?.username, action: 'user.create', details: `Usuário "${username.trim()}" criado (${finalRole === 'admin' ? 'administrador' : 'usuário'})` });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

// Escape hatch pra quando um usuário perde o celular/app autenticador e os
// códigos de recuperação: um admin desativa o 2FA dele sem precisar de
// código (o próprio dono usa POST /api/auth/totp/disable, que exige um
// código válido — essa aqui é só pra quando isso não é mais possível).
usersRouter.post('/:id/totp-disable', (req, res) => {
  const target = getTotpStmt.get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!target.totpEnabled) return res.status(400).json({ error: '2FA não está ativado para esse usuário.' });
  disableTotpStmt.run(req.params.id);
  logAudit({ username: req.user?.username, action: 'user.2fa_admin_disable', details: `2FA de "${target.username}" desativado por um administrador` });
  res.json({ ok: true });
});

usersRouter.delete('/:id', (req, res) => {
  if (countStmt.get().n <= 1) {
    return res.status(400).json({ error: 'Não é possível remover o único usuário do painel.' });
  }
  const target = getByIdStmt.get(req.params.id);
  deleteStmt.run(req.params.id);
  if (target) logAudit({ username: req.user?.username, action: 'user.delete', details: `Usuário "${target.username}" removido` });
  res.status(204).end();
});
