import { db } from '../db/sqlite.js';

const EVENT_LABEL = { went_offline: 'Ficou offline', went_online: 'Voltou online', degraded: 'Ficou degradado' };

/**
 * Histórico de eventos (queda/recuperação) de todos os dispositivos, com a
 * duração do estado anterior calculada por dispositivo (ex.: um evento
 * "Voltou online" mostra havia quanto tempo estava offline). Filtrável por
 * dispositivo, tipo de evento e período — para responder exatamente
 * "quando caiu, quando voltou, quanto tempo ficou fora" por equipamento ou
 * pra rede inteira.
 */
export function getEventsHistory({ deviceId, eventType, from, to, limit = 200 } = {}) {
  const conditions = [];
  const params = {};

  if (deviceId) { conditions.push('e.device_id = @deviceId'); params.deviceId = deviceId; }
  if (eventType) { conditions.push('e.event_type = @eventType'); params.eventType = eventType; }
  if (from) { conditions.push('e.at >= @from'); params.from = from; }
  if (to) { conditions.push('e.at <= @to'); params.to = to; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.limit = Math.min(Number(limit) || 200, 1000);

  const rows = db.prepare(`
    SELECT e.id, e.device_id AS deviceId, e.event_type AS eventType, e.at,
           d.name, d.ip, d.type, d.location, d.vendor, d.model,
           LAG(e.at) OVER (PARTITION BY e.device_id ORDER BY e.at) AS prevAt
    FROM device_events e
    JOIN devices d ON d.id = e.device_id
    ${where}
    ORDER BY e.at DESC
    LIMIT @limit
  `).all(params);

  return rows.map((row) => ({
    id: row.id,
    deviceId: row.deviceId,
    device: { name: row.name, ip: row.ip, type: row.type, location: row.location, vendor: row.vendor, model: row.model },
    eventType: row.eventType,
    eventLabel: EVENT_LABEL[row.eventType] || row.eventType,
    at: row.at,
    // Duração do estado ANTERIOR a este evento (ex.: em "voltou online",
    // quanto tempo ficou offline; em "ficou offline", quanto tempo ficou
    // online antes de cair). Null no primeiro evento já visto do
    // dispositivo, por falta de um "antes" pra comparar.
    durationMs: row.prevAt ? new Date(row.at).getTime() - new Date(row.prevAt).getTime() : null,
  }));
}

const lastEventBeforeStmt = db.prepare(`
  SELECT event_type AS eventType FROM device_events
  WHERE device_id = ? AND at < ? AND event_type IN ('went_offline', 'went_online')
  ORDER BY at DESC LIMIT 1
`);
const eventsInWindowStmt = db.prepare(`
  SELECT event_type AS eventType, at FROM device_events
  WHERE device_id = ? AND at >= ? AND event_type IN ('went_offline', 'went_online')
  ORDER BY at ASC
`);

/**
 * % do período em que o dispositivo respondeu ping (offline por "degradado"
 * não conta contra o uptime — o equipamento está na rede, só o serviço numa
 * porta específica é que não respondeu). Sem nenhum evento no histórico,
 * assume 100% (não há registro de queda) em vez de penalizar equipamento
 * que nunca caiu.
 */
export function getDeviceUptime(deviceId, days = 7) {
  const windowMs = days * 86400 * 1000;
  const windowStart = new Date(Date.now() - windowMs);
  const windowStartIso = windowStart.toISOString();

  const before = lastEventBeforeStmt.get(deviceId, windowStartIso);
  let state = before?.eventType === 'went_offline' ? 'offline' : 'online';
  let cursor = windowStart.getTime();
  let offlineMs = 0;

  for (const ev of eventsInWindowStmt.all(deviceId, windowStartIso)) {
    const at = new Date(ev.at).getTime();
    if (state === 'offline') offlineMs += at - cursor;
    cursor = at;
    state = ev.eventType === 'went_online' ? 'online' : 'offline';
  }
  if (state === 'offline') offlineMs += Date.now() - cursor;

  const uptimePercent = Math.max(0, Math.min(100, 100 * (1 - offlineMs / windowMs)));
  return { days, uptimePercent: Math.round(uptimePercent * 100) / 100, offlineMs };
}
