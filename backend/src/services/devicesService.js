import { db } from '../db/sqlite.js';
import { encryptSecret, decryptSecret } from './cryptoService.js';
import { getDeviceUptime } from './eventsService.js';

export const DEVICE_TYPES = ['nvr', 'camera', 'porteiro', 'interfone', 'switch', 'ap', 'servidor', 'outro'];

const insertStmt = db.prepare(`
  INSERT INTO devices (ip, name, type, location, ports, notes, enabled, mac, vendor, model, device_username, device_password_enc)
  VALUES (@ip, @name, @type, @location, @ports, @notes, @enabled, @mac, @vendor, @model, @deviceUsername, @devicePasswordEnc)
`);
const updateStmt = db.prepare(`
  UPDATE devices SET ip=@ip, name=@name, type=@type, location=@location, ports=@ports, notes=@notes,
         enabled=@enabled, mac=@mac, vendor=@vendor, model=@model,
         device_username=@deviceUsername, device_password_enc=@devicePasswordEnc
  WHERE id=@id
`);
const toggleFavoriteStmt = db.prepare('UPDATE devices SET favorite = @favorite WHERE id = @id');
const deleteStmt = db.prepare('DELETE FROM devices WHERE id = ?');
const getByIdStmt = db.prepare('SELECT * FROM devices WHERE id = ?');
const getByIpStmt = db.prepare('SELECT * FROM devices WHERE ip = ?');
const ensureStatusStmt = db.prepare(`
  INSERT INTO device_status (device_id, status) VALUES (?, 'unknown')
  ON CONFLICT(device_id) DO NOTHING
`);

const listWithStatusStmt = db.prepare(`
  SELECT d.*, s.status AS status, s.latency_ms AS latencyMs, s.last_check_at AS lastCheckAt,
         s.last_online_at AS lastOnlineAt, s.last_offline_at AS lastOfflineAt,
         s.consecutive_fails AS consecutiveFails
  FROM devices d
  LEFT JOIN device_status s ON s.device_id = d.id
  ORDER BY d.type, d.location, d.name
`);

const recentChecksStmt = db.prepare(`
  SELECT at, ok, latency_ms AS latencyMs FROM device_checks
  WHERE device_id = ? ORDER BY at DESC LIMIT 60
`);
const recentEventsStmt = db.prepare(`
  SELECT event_type AS eventType, at FROM device_events
  WHERE device_id = ? ORDER BY at DESC LIMIT 30
`);

function normalizePorts(ports) {
  if (Array.isArray(ports)) {
    return JSON.stringify(ports.map(Number).filter((p) => Number.isInteger(p) && p > 0 && p < 65536));
  }
  if (typeof ports === 'string' && ports.trim()) {
    const list = ports.split(/[;,]/).map((p) => Number(p.trim())).filter((p) => Number.isInteger(p) && p > 0 && p < 65536);
    return JSON.stringify(list);
  }
  return '[]';
}

function rowToDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    ip: row.ip,
    name: row.name,
    type: row.type,
    location: row.location,
    ports: JSON.parse(row.ports || '[]'),
    notes: row.notes,
    enabled: !!row.enabled,
    mac: row.mac || '',
    vendor: row.vendor || '',
    model: row.model || '',
    // O usuário de acesso do equipamento aparece na listagem (não é
    // sensível sozinho), mas a senha só é descriptografada e incluída no
    // detalhe de UM dispositivo (getDevice) — nunca em listDevices/WS, pra
    // não trafegar todas as senhas criptografadas a cada rodada de polling.
    username: row.device_username || '',
    favorite: !!row.favorite,
    status: row.status || 'unknown',
    latencyMs: row.latencyMs ?? null,
    lastCheckAt: row.lastCheckAt || null,
    lastOnlineAt: row.lastOnlineAt || null,
    lastOfflineAt: row.lastOfflineAt || null,
    consecutiveFails: row.consecutiveFails || 0,
  };
}

export function listDevices() {
  return listWithStatusStmt.all().map(rowToDevice);
}

export function getDevice(id) {
  const row = db.prepare(`
    SELECT d.*, s.status AS status, s.latency_ms AS latencyMs, s.last_check_at AS lastCheckAt,
           s.last_online_at AS lastOnlineAt, s.last_offline_at AS lastOfflineAt,
           s.consecutive_fails AS consecutiveFails
    FROM devices d LEFT JOIN device_status s ON s.device_id = d.id
    WHERE d.id = ?
  `).get(id);
  if (!row) return null;
  const device = rowToDevice(row);
  device.recentChecks = recentChecksStmt.all(id).reverse().map((c) => ({ at: c.at, ok: !!c.ok, latencyMs: c.latencyMs }));
  device.recentEvents = recentEventsStmt.all(id);
  try { device.discoveryInfo = JSON.parse(row.discovery_info || '{}'); } catch { device.discoveryInfo = {}; }
  device.password = decryptSecret(row.device_password_enc);
  device.uptime7d = getDeviceUptime(id, 7).uptimePercent;
  return device;
}

export function createDevice(input) {
  const ip = String(input.ip || '').trim();
  const name = String(input.name || '').trim() || ip;
  if (!ip) throw new Error('IP é obrigatório.');
  if (getByIpStmt.get(ip)) throw new Error(`Já existe um dispositivo cadastrado com o IP ${ip}.`);

  const info = insertStmt.run({
    ip,
    name,
    type: DEVICE_TYPES.includes(input.type) ? input.type : 'outro',
    location: String(input.location || '').trim(),
    ports: normalizePorts(input.ports),
    notes: String(input.notes || '').trim(),
    enabled: input.enabled === false ? 0 : 1,
    mac: String(input.mac || '').trim().toLowerCase(),
    vendor: String(input.vendor || '').trim(),
    model: String(input.model || '').trim(),
    deviceUsername: String(input.username || '').trim(),
    devicePasswordEnc: input.password ? encryptSecret(String(input.password)) : '',
  });
  ensureStatusStmt.run(info.lastInsertRowid);
  return getDevice(info.lastInsertRowid);
}

export function updateDevice(id, input) {
  const existing = getByIdStmt.get(id);
  if (!existing) throw new Error('Dispositivo não encontrado.');
  const ip = String(input.ip ?? existing.ip).trim();
  const clash = getByIpStmt.get(ip);
  if (clash && clash.id !== id) throw new Error(`Já existe um dispositivo cadastrado com o IP ${ip}.`);

  updateStmt.run({
    id,
    ip,
    name: String(input.name ?? existing.name).trim() || ip,
    type: DEVICE_TYPES.includes(input.type) ? input.type : existing.type,
    location: input.location !== undefined ? String(input.location).trim() : existing.location,
    ports: input.ports !== undefined ? normalizePorts(input.ports) : existing.ports,
    notes: input.notes !== undefined ? String(input.notes).trim() : existing.notes,
    enabled: input.enabled === undefined ? existing.enabled : (input.enabled ? 1 : 0),
    mac: input.mac !== undefined ? String(input.mac).trim().toLowerCase() : existing.mac,
    vendor: input.vendor !== undefined ? String(input.vendor).trim() : existing.vendor,
    model: input.model !== undefined ? String(input.model).trim() : existing.model,
    deviceUsername: input.username !== undefined ? String(input.username).trim() : existing.device_username,
    // Sem `password` no payload: mantém a senha já salva (já criptografada,
    // não precisa descriptografar/recriptografar). Com `password: ''`
    // explícito: apaga. Com valor novo: criptografa de novo.
    devicePasswordEnc: input.password !== undefined
      ? (input.password ? encryptSecret(String(input.password)) : '')
      : existing.device_password_enc,
  });
  return getDevice(id);
}

export function deleteDevice(id) {
  deleteStmt.run(id);
}

export function setFavorite(id, favorite) {
  toggleFavoriteStmt.run({ id, favorite: favorite ? 1 : 0 });
  return getDevice(id);
}

// Usado pelo importador CSV e pelo scan de rede: cria se o IP não existe,
// atualiza campos informados se já existe (nunca apaga um cadastro manual
// mais detalhado por causa de uma reimportação incompleta).
export function upsertDeviceByIp(input) {
  const ip = String(input.ip || '').trim();
  if (!ip) throw new Error('IP é obrigatório.');
  const existing = getByIpStmt.get(ip);
  if (existing) {
    return updateDevice(existing.id, { ...input, ip });
  }
  return createDevice({ ...input, ip });
}

export function getSummary() {
  const devices = listDevices().filter((d) => d.enabled);
  const summary = { total: devices.length, online: 0, offline: 0, degraded: 0, unknown: 0, byType: {} };
  for (const d of devices) {
    summary[d.status] = (summary[d.status] || 0) + 1;
    if (!summary.byType[d.type]) summary.byType[d.type] = { total: 0, online: 0, offline: 0, degraded: 0, unknown: 0 };
    summary.byType[d.type].total += 1;
    summary.byType[d.type][d.status] = (summary.byType[d.type][d.status] || 0) + 1;
  }
  return summary;
}
