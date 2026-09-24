import { db } from '../db/sqlite.js';
import { getSettings } from './settingsService.js';

const getStmt = db.prepare('SELECT * FROM login_attempts WHERE key = ?');
const upsertStmt = db.prepare(`
  INSERT INTO login_attempts (key, fail_count, first_fail_at, locked_until) VALUES (@key, @failCount, @firstFailAt, @lockedUntil)
  ON CONFLICT(key) DO UPDATE SET fail_count = excluded.fail_count, first_fail_at = excluded.first_fail_at, locked_until = excluded.locked_until
`);
const deleteStmt = db.prepare('DELETE FROM login_attempts WHERE key = ?');

export function checkLoginLock(key) {
  const row = getStmt.get(key);
  if (row?.locked_until && new Date(row.locked_until) > new Date()) {
    return { locked: true, retryAfterSeconds: Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000) };
  }
  return { locked: false };
}

// Contador com janela deslizante simples: falhas antigas (fora da janela)
// não somam pro bloqueio — assim uma pessoa que erra a senha 1x por mês não
// acaba bloqueada por acidente meses depois.
export function registerLoginFailure(key) {
  const settings = getSettings();
  const maxAttempts = Number(settings.loginMaxAttempts) || 5;
  const windowMs = (Number(settings.loginAttemptWindowMinutes) || 15) * 60000;
  const lockoutMs = (Number(settings.loginLockoutMinutes) || 15) * 60000;

  const now = new Date();
  const row = getStmt.get(key);
  const windowExpired = row && (now.getTime() - new Date(row.first_fail_at).getTime()) > windowMs;
  const failCount = (!row || windowExpired) ? 1 : row.fail_count + 1;
  const firstFailAt = (!row || windowExpired) ? now.toISOString() : row.first_fail_at;
  const locked = failCount >= maxAttempts;
  const lockedUntil = locked ? new Date(now.getTime() + lockoutMs).toISOString() : null;

  upsertStmt.run({ key, failCount, firstFailAt, lockedUntil });
  return { failCount, maxAttempts, locked, lockoutMinutes: lockoutMs / 60000 };
}

export function registerLoginSuccess(key) {
  deleteStmt.run(key);
}
