import { db } from '../db/sqlite.js';

const insertStmt = db.prepare(`
  INSERT INTO network_history (at, total, online, offline, degraded, avg_latency_ms)
  VALUES (@at, @total, @online, @offline, @degraded, @avgLatencyMs)
`);
const pruneStmt = db.prepare(`DELETE FROM network_history WHERE at < ?`);
const rangeStmt = db.prepare(`
  SELECT at, total, online, offline, degraded, avg_latency_ms AS avgLatencyMs
  FROM network_history WHERE at >= ? ORDER BY at ASC
`);

// Um retrato da rede inteira a cada rodada de monitoramento — separado dos
// detalhes por dispositivo (device_checks), serve só para o gráfico geral
// "saúde da rede ao longo do tempo".
export function recordNetworkSnapshot(results) {
  const total = results.length;
  if (total === 0) return;
  const online = results.filter((r) => r.status === 'online').length;
  const offline = results.filter((r) => r.status === 'offline').length;
  const degraded = results.filter((r) => r.status === 'degraded').length;
  const latencies = results.map((r) => r.latencyMs).filter((v) => v != null);
  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

  insertStmt.run({ at: new Date().toISOString(), total, online, offline, degraded, avgLatencyMs });
}

export function pruneNetworkHistory(retentionHours) {
  const cutoff = new Date(Date.now() - retentionHours * 3600 * 1000).toISOString();
  pruneStmt.run(cutoff);
}

export function getNetworkHistory(hours = 24) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  return rangeStmt.all(since);
}
