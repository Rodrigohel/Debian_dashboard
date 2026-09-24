import { db } from '../db/sqlite.js';

const insertStmt = db.prepare('INSERT INTO audit_log (at, username, action, details) VALUES (@at, @username, @action, @details)');
const listStmt = db.prepare('SELECT id, at, username, action, details FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?');
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM audit_log');

// Chamado depois que a ação já foi concluída com sucesso — uma falha aqui
// (ex.: disco cheio) não pode derrubar a ação principal, só fica sem
// registro dessa vez.
export function logAudit({ username, action, details = '' }) {
  try {
    // Timestamp ISO explícito (em vez do default datetime('now') do SQLite,
    // sem timezone) — mesmo padrão usado em device_events, pra new Date(...)
    // no frontend interpretar como UTC corretamente em vez de hora local.
    insertStmt.run({ at: new Date().toISOString(), username: username || 'sistema', action, details });
  } catch (err) {
    console.error('[audit] falha ao registrar evento:', err.message);
  }
}

export function listAuditLog({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return { data: listStmt.all(safeLimit, safeOffset), total: countStmt.get().n };
}
