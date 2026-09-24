import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { checkLoginLock, registerLoginFailure, registerLoginSuccess } from '../services/loginThrottleService.js';
import { logAudit } from '../services/auditService.js';
import { generateSecret, verifyToken, buildOtpauthUri, generateRecoveryCodes } from '../services/totpService.js';
import { getSettings } from '../services/settingsService.js';

export const authRouter = Router();

const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const setTotpStmt = db.prepare('UPDATE users SET totp_secret = @secret, totp_enabled = @enabled, totp_recovery_codes = @recoveryCodes WHERE id = @id');

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, displayName: user.display_name, role: user.role },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

function userPayload(user) {
  return { username: user.username, displayName: user.display_name, role: user.role };
}

// Verifica um código de 6 dígitos contra o TOTP do usuário OU contra um dos
// códigos de recuperação salvos (hash bcrypt) — se for um código de
// recuperação, ele é consumido (removido da lista) na hora, uso único.
function verifyTotpOrRecovery(user, code) {
  if (verifyToken(user.totp_secret, code)) return { ok: true };

  let recoveryCodes = [];
  try { recoveryCodes = JSON.parse(user.totp_recovery_codes || '[]'); } catch { recoveryCodes = []; }
  const matchIndex = recoveryCodes.findIndex((hash) => bcrypt.compareSync(String(code || ''), hash));
  if (matchIndex === -1) return { ok: false };

  recoveryCodes.splice(matchIndex, 1);
  setTotpStmt.run({ id: user.id, secret: user.totp_secret, enabled: 1, recoveryCodes: JSON.stringify(recoveryCodes) });
  return { ok: true, usedRecoveryCode: true, remainingRecoveryCodes: recoveryCodes.length };
}

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

  // Senha certa, mas com 2FA ativado a etapa não terminou — não conta como
  // sucesso nem falha do bloqueio de tentativas ainda (só a etapa seguinte,
  // POST /login/totp, decide isso).
  if (user.totp_enabled) {
    const totpToken = jwt.sign({ sub: user.id, purpose: 'totp-pending' }, config.auth.jwtSecret, { expiresIn: '5m' });
    return res.json({ requiresTotp: true, totpToken });
  }

  registerLoginSuccess(throttleKey);
  logAudit({ username: user.username, action: 'login', details: 'Login bem-sucedido' });
  res.json({ token: issueToken(user), user: userPayload(user) });
});

authRouter.post('/login/totp', (req, res) => {
  const { totpToken, code } = req.body || {};
  if (!totpToken || !code) return res.status(400).json({ error: 'Código é obrigatório.' });

  const throttleKey = req.ip;
  const lock = checkLoginLock(throttleKey);
  if (lock.locked) {
    const minutes = Math.ceil(lock.retryAfterSeconds / 60);
    return res.status(429).json({ error: `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes === 1 ? '' : 's'}.` });
  }

  let payload;
  try {
    payload = jwt.verify(totpToken, config.auth.jwtSecret);
    if (payload.purpose !== 'totp-pending') throw new Error('purpose inválido');
  } catch {
    return res.status(401).json({ error: 'Sessão de login expirada — comece de novo.' });
  }

  const user = getUserByIdStmt.get(payload.sub);
  if (!user || !user.totp_enabled) return res.status(401).json({ error: 'Sessão de login expirada — comece de novo.' });

  const result = verifyTotpOrRecovery(user, code);
  if (!result.ok) {
    const throttle = registerLoginFailure(throttleKey);
    logAudit({
      username: user.username,
      action: 'login.failed',
      details: throttle.locked
        ? `Código de 2FA inválido — bloqueado por ${throttle.lockoutMinutes} min após ${throttle.failCount} tentativas`
        : `Código de 2FA inválido (tentativa ${throttle.failCount}/${throttle.maxAttempts})`,
    });
    return res.status(401).json({ error: 'Código inválido.' });
  }

  registerLoginSuccess(throttleKey);
  logAudit({
    username: user.username,
    action: 'login',
    details: result.usedRecoveryCode
      ? `Login bem-sucedido com código de recuperação (restam ${result.remainingRecoveryCodes})`
      : 'Login bem-sucedido (2FA)',
  });
  res.json({ token: issueToken(user), user: userPayload(user) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.sub);
  res.json({ ...req.user, totpEnabled: !!user?.totp_enabled });
});

// --- Autogerenciamento de 2FA (cada usuário liga/desliga o próprio) ---

// Gera um secret novo (ainda não salvo) + a URI otpauth:// pro app
// autenticador escanear via QR — só é persistido no banco em /totp/enable,
// depois de confirmar que a pessoa realmente configurou certo.
authRouter.post('/totp/setup', requireAuth, (req, res) => {
  const secret = generateSecret();
  const issuer = getSettings().siteName || 'Monitoramento de Rede';
  const otpauthUri = buildOtpauthUri({ secret, username: req.user.username, issuer });
  res.json({ secret, otpauthUri });
});

authRouter.post('/totp/enable', requireAuth, (req, res) => {
  const { secret, code } = req.body || {};
  if (!secret || !code) return res.status(400).json({ error: 'Secret e código são obrigatórios.' });
  if (!verifyToken(secret, code)) return res.status(400).json({ error: 'Código inválido — confira o horário do celular e tente de novo.' });

  const recoveryCodes = generateRecoveryCodes();
  const hashed = recoveryCodes.map((c) => bcrypt.hashSync(c, 10));
  setTotpStmt.run({ id: req.user.sub, secret, enabled: 1, recoveryCodes: JSON.stringify(hashed) });
  logAudit({ username: req.user.username, action: 'user.2fa_enable', details: `2FA ativado para "${req.user.username}"` });
  res.json({ recoveryCodes });
});

authRouter.post('/totp/disable', requireAuth, (req, res) => {
  const user = getUserByIdStmt.get(req.user.sub);
  if (!user?.totp_enabled) return res.status(400).json({ error: '2FA não está ativado.' });

  const { code } = req.body || {};
  if (!code || !verifyTotpOrRecovery(user, code).ok) {
    return res.status(401).json({ error: 'Código inválido.' });
  }

  setTotpStmt.run({ id: req.user.sub, secret: '', enabled: 0, recoveryCodes: '[]' });
  logAudit({ username: req.user.username, action: 'user.2fa_disable', details: `2FA desativado para "${req.user.username}"` });
  res.json({ ok: true });
});
