import { db } from '../db/sqlite.js';
import { sendTelegramMessage } from './telegramService.js';
import { getSettings } from './settingsService.js';

const upsertStmt = db.prepare(`
  INSERT INTO alerts (id, severity, message, created_at, status, source_key)
  VALUES (@id, @severity, @message, @created_at, @status, @source_key)
  ON CONFLICT(id) DO UPDATE SET status = @status, message = @message
`);
const resolveBySourceStmt = db.prepare(`UPDATE alerts SET status = 'resolved' WHERE source_key = ? AND status = 'active'`);
const getByIdStmt = db.prepare(`SELECT status, last_notified_at, notified_active FROM alerts WHERE id = ?`);
const getActiveBySourceStmt = db.prepare(`SELECT id, message, notified_active FROM alerts WHERE source_key = ? AND status = 'active'`);
const touchNotifiedStmt = db.prepare(`UPDATE alerts SET last_notified_at = ?, notified_active = 1 WHERE id = ?`);
const clearNotifiedStmt = db.prepare(`UPDATE alerts SET notified_active = 0 WHERE id = ?`);
const listStmt = db.prepare(`SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100`);
const countActiveStmt = db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active'`);

const SEVERITY_EMOJI = { critical: '🔴', warning: '🟠', info: 'ℹ️' };

// Dispositivos em rede instável (ex.: interfone em link celular/rádio) podem
// oscilar offline/online várias vezes seguidas — o cooldown evita reenviar
// "ativo" a cada oscilação. Resolver rápido (o caso mais comum: caiu, voltou
// em poucos minutos) NÃO fica sujeito a esse cooldown, senão o "voltou"
// nunca chegaria — a pessoa só veria o aviso de offline e, ao checar o
// painel depois, o equipamento já estaria online de novo.
const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;

function canNotify(lastNotifiedAt, intervalMs) {
  if (!lastNotifiedAt) return true;
  return Date.now() - new Date(lastNotifiedAt).getTime() >= intervalMs;
}

function notify(id, text) {
  sendTelegramMessage(text);
  touchNotifiedStmt.run(new Date().toISOString(), id);
}

function upsertAlert({ id, severity, message, status, source_key }, reminderIntervalMs = 0) {
  const existing = getByIdStmt.get(id);
  upsertStmt.run({ id, severity, message, created_at: new Date().toISOString(), status, source_key });
  const justActivated = status === 'active' && (!existing || existing.status === 'resolved');
  if (justActivated) {
    if (canNotify(existing?.last_notified_at, NOTIFY_COOLDOWN_MS)) {
      notify(id, `${SEVERITY_EMOJI[severity] || '⚠️'} ${message}`);
    } else {
      clearNotifiedStmt.run(id);
    }
  } else if (
    status === 'active' && existing && existing.status === 'active' && existing.notified_active &&
    reminderIntervalMs > 0 && canNotify(existing.last_notified_at, reminderIntervalMs)
  ) {
    notify(id, `🔁 Ainda ativo: ${message}`);
  }
}

function resolveAlert(sourceKey, resolvedMessage) {
  const activeAlert = getActiveBySourceStmt.get(sourceKey);
  const info = resolveBySourceStmt.run(sourceKey);
  if (info.changes > 0 && activeAlert && activeAlert.notified_active) {
    notify(activeAlert.id, `✅ ${resolvedMessage || `Resolvido: ${activeAlert.message}`}`);
    clearNotifiedStmt.run(activeAlert.id);
  }
}

function reminderIntervalMs() {
  const minutes = Number(getSettings().alertReminderIntervalMinutes) || 0;
  return minutes > 0 ? minutes * 60 * 1000 : 0;
}

function typeLabel(type) {
  const labels = { nvr: 'NVR', camera: 'Câmera', porteiro: 'Porteiro', interfone: 'Interfone', switch: 'Switch', ap: 'AP', servidor: 'Servidor', outro: 'Equipamento' };
  return labels[type] || 'Equipamento';
}

function deviceLabel(device) {
  const loc = device.location ? ` — ${device.location}` : '';
  const label = typeLabel(device.type);
  // Evita duplicar o tipo quando o nome já o inclui (ex.: nome "NVR
  // Portaria" não deveria virar "NVR NVR Portaria" na mensagem).
  const prefix = device.name.toLowerCase().includes(label.toLowerCase()) ? '' : `${label} `;
  return `${prefix}${device.name} (${device.ip})${loc}`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
  return `${minutes}min`;
}

// --- API usada pelo monitorService, chamada diretamente nas transições de
// estado (o monitor já sabe, no momento em que checa, se um dispositivo
// mudou de estado — não precisa de uma varredura periódica separada). ---

export function raiseDeviceOffline(device) {
  const sourceKey = `device-offline-${device.id}`;
  const message = `${deviceLabel(device)} ficou OFFLINE (sem resposta de ping)`;
  upsertAlert({ id: sourceKey, severity: 'critical', message, status: 'active', source_key: sourceKey }, reminderIntervalMs());
}

export function resolveDeviceOffline(device, offlineSinceMs) {
  const sourceKey = `device-offline-${device.id}`;
  const duration = offlineSinceMs ? ` após ${formatDuration(Date.now() - offlineSinceMs)} offline` : '';
  resolveAlert(sourceKey, `${deviceLabel(device)} voltou ONLINE${duration}`);
}

export function raiseDeviceDegraded(device) {
  const sourceKey = `device-degraded-${device.id}`;
  const message = `${deviceLabel(device)} responde ping mas o(s) serviço(s) na(s) porta(s) configurada(s) não respondem`;
  upsertAlert({ id: sourceKey, severity: 'warning', message, status: 'active', source_key: sourceKey }, reminderIntervalMs());
}

export function resolveDeviceDegraded(device) {
  const sourceKey = `device-degraded-${device.id}`;
  resolveAlert(sourceKey, `${deviceLabel(device)} voltou a responder normalmente`);
}

function rowToAlert(row) {
  return { id: row.id, severity: row.severity, message: row.message, createdAt: row.created_at, status: row.status };
}

export function getAlerts() {
  return listStmt.all().map(rowToAlert);
}

export function getActiveAlertsCount() {
  return countActiveStmt.get().n;
}
