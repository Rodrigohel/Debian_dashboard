import { db } from '../db/sqlite.js';
import { pingHost } from './pingService.js';
import { checkAnyTcpPort } from './tcpCheckService.js';
import { listDevices } from './devicesService.js';
import { getSettings } from './settingsService.js';
import { readArpTable } from './macService.js';
import { lookupVendor } from './ouiService.js';
import {
  raiseDeviceOffline, resolveDeviceOffline, raiseDeviceDegraded, resolveDeviceDegraded,
} from './alertsService.js';

const updateStatusStmt = db.prepare(`
  UPDATE device_status
  SET status = @status, latency_ms = @latencyMs, last_check_at = @now,
      last_online_at = COALESCE(@lastOnlineAt, last_online_at),
      last_offline_at = COALESCE(@lastOfflineAt, last_offline_at),
      consecutive_fails = @consecutiveFails
  WHERE device_id = @deviceId
`);
const insertCheckStmt = db.prepare(`
  INSERT INTO device_checks (device_id, at, ok, latency_ms) VALUES (?, ?, ?, ?)
`);
const insertEventStmt = db.prepare(`
  INSERT INTO device_events (device_id, event_type, at) VALUES (?, ?, ?)
`);
const pruneChecksStmt = db.prepare(`DELETE FROM device_checks WHERE at < ?`);
// Só preenche o fabricante quando ele ainda estiver vazio — se alguém
// corrigiu manualmente (ex.: equipamento com chip de rede de um fabricante
// mas vendido com marca própria, comum em produtos Intelbras/OEM), o
// ciclo de monitoramento não deve sobrescrever de volta a cada rodada.
const updateMacStmt = db.prepare(`UPDATE devices SET mac = @mac, vendor = @vendor WHERE id = @id`);

// Roda um lote de tarefas assíncronas com no máximo `limit` em paralelo por
// vez — evita disparar ~230 processos `ping` de uma vez só no sistema.
export async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function checkDevice(device, settings, arpTable) {
  const timeoutMs = settings.pingTimeoutMs;
  const ping = await pingHost(device.ip, timeoutMs);
  const now = new Date().toISOString();

  let status;
  let consecutiveFails = device.consecutiveFails || 0;
  let mac = device.mac;
  let vendor = device.vendor;

  if (ping.ok) {
    consecutiveFails = 0;
    const tcpOk = device.ports.length > 0 ? await checkAnyTcpPort(device.ip, device.ports, timeoutMs) : null;
    status = tcpOk === false ? 'degraded' : 'online';

    // MAC é resolvido de graça: o próprio ping que acabou de rodar já
    // populou a tabela ARP do kernel para esse IP.
    const discoveredMac = arpTable.get(device.ip);
    if (discoveredMac && discoveredMac !== device.mac) {
      mac = discoveredMac;
      vendor = device.vendor || lookupVendor(discoveredMac) || '';
      updateMacStmt.run({ id: device.id, mac, vendor });
    }
  } else {
    consecutiveFails += 1;
    status = consecutiveFails >= settings.offlineThresholdFails ? 'offline' : device.status;
  }

  const previousStatus = device.status;
  const lastOnlineAt = status === 'online' || status === 'degraded' ? now : null;
  const lastOfflineAt = status === 'offline' ? now : null;

  updateStatusStmt.run({
    deviceId: device.id,
    status,
    latencyMs: ping.latencyMs,
    now,
    lastOnlineAt,
    lastOfflineAt,
    consecutiveFails,
  });
  insertCheckStmt.run(device.id, now, ping.ok ? 1 : 0, ping.latencyMs);

  if (previousStatus !== status) {
    if (status === 'offline') {
      insertEventStmt.run(device.id, 'went_offline', now);
      raiseDeviceOffline(device);
    } else if (previousStatus === 'offline') {
      insertEventStmt.run(device.id, 'went_online', now);
      resolveDeviceOffline(device, device.lastOfflineAt ? new Date(device.lastOfflineAt).getTime() : null);
    }

    if (status === 'degraded' && previousStatus !== 'offline') {
      insertEventStmt.run(device.id, 'degraded', now);
      raiseDeviceDegraded(device);
    } else if (previousStatus === 'degraded' && status === 'online') {
      resolveDeviceDegraded(device);
    }
  }

  return { ...device, status, latencyMs: ping.latencyMs, lastCheckAt: now, mac, vendor };
}

export async function runMonitorCycle() {
  const settings = getSettings();
  const numericSettings = {
    pingTimeoutMs: Number(settings.pingTimeoutMs),
    offlineThresholdFails: Number(settings.offlineThresholdFails),
  };
  const devices = listDevices().filter((d) => d.enabled);
  const arpTable = await readArpTable();

  const results = [];
  await runWithConcurrency(devices, Number(settings.pingConcurrency) || 25, async (device) => {
    try {
      results.push(await checkDevice(device, numericSettings, arpTable));
    } catch (err) {
      console.error(`[monitor] erro ao checar ${device.ip}:`, err.message);
    }
  });

  const retentionHours = Number(settings.checksRetentionHours) || 6;
  const cutoff = new Date(Date.now() - retentionHours * 3600 * 1000).toISOString();
  pruneChecksStmt.run(cutoff);

  return results;
}

// Reagenda a si mesmo em vez de setInterval: uma rodada que demore mais que
// o intervalo configurado (ex.: rede com muita perda de pacote, todo mundo
// estourando o timeout) não pode se sobrepor à próxima rodada — duas
// rodadas concorrentes escrevendo nas mesmas linhas de device_status
// poderiam intercalar de forma inconsistente.
let running = false;
let latestSettingsGetter = getSettings;

export function startMonitorLoop(onCycleComplete) {
  async function tick() {
    if (running) return;
    running = true;
    try {
      const results = await runMonitorCycle();
      if (results.length > 0 && onCycleComplete) onCycleComplete(results);
    } catch (err) {
      console.error('[monitor] erro na rodada de verificação:', err.message);
    } finally {
      running = false;
      const intervalMs = (Number(latestSettingsGetter().pingIntervalSeconds) || 20) * 1000;
      setTimeout(tick, intervalMs);
    }
  }
  tick();
}
