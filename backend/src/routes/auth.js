import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { checkLoginLock, registerLoginFailure, registerLoginSuccess } from '../services/loginThrottleService.js';
import { logAudit } from '../services/auditService.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  // Chave por IP de origem, não por usuário: evita tanto alguém tentar
  // adivinhar a senha de uma conta específica quanto varrer vários usuários
  // a partir da mesma máquina.
  const throttleKey = req.ip;
  const lock = checkLoginLock(throttleKey);
  if (lock.locked) {
    const minutes = Math.ceil(lock.retryAfterSeconds / 60);
    return res.status(429).json({ error: `Muitas tentativas de login. Tente novamente em ${minutes} minuto${minutes === 1 ? '' : 's'}.` });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    const result = registerLoginFailure(throttleKey);
    logAudit({
      username: String(username).slice(0, 60),
      action: 'login.failed',
      details: result.locked
        ? `Login falhou — bloqueado por ${result.lockoutMinutes} min após ${result.failCount} tentativas`
        : `Login falhou (tentativa ${result.failCount}/${result.maxAttempts})`,
    });
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  registerLoginSuccess(throttleKey);
  logAudit({ username: user.username, action: 'login', details: 'Login bem-sucedido' });

  const token = jwt.sign(
    { sub: user.id, username: user.username, displayName: user.display_name, role: user.role },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );

  res.json({ token, user: { username: user.username, displayName: user.display_name, role: user.role } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, displayName: req.user.displayName, role: req.user.role });
});
