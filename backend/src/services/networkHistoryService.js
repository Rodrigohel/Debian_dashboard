import { db } from '../db/sqlite.js';

const insertStmt = db.prepare(`
  INSERT INTO network_history (at, total, online, offline, degraded, avg_latency_ms, p50_latency_ms, p95_latency_ms, max_latency_ms)
  VALUES (@at, @total, @online, @offline, @degraded, @avgLatencyMs, @p50LatencyMs, @p95LatencyMs, @maxLatencyMs)
`);
const pruneStmt = db.prepare(`DELETE FROM network_history WHERE at < ?`);
const rangeStmt = db.prepare(`
  SELECT at, total, online, offline, degraded, avg_latency_ms AS avgLatencyMs,
         p50_latency_ms AS p50LatencyMs, p95_latency_ms AS p95LatencyMs, max_latency_ms AS maxLatencyMs
  FROM network_history WHERE at >= ? ORDER BY at ASC
`);

// Percentil por interpolação nearest-rank sobre um array já ordenado — usado
// para a mediana (p50) e o p95 da latência de cada rodada. p95 mostra os
// picos sem deixar 1 dispositivo ruim isolado dominar como o máximo bruto.
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

// Um retrato da rede inteira a cada rodada de monitoramento — separado dos
// detalhes por dispositivo (device_checks), serve só para o gráfico geral
// "saúde da rede ao longo do tempo".
export function recordNetworkSnapshot(results) {
  const total = results.length;
  if (total === 0) return;
  const online = results.filter((r) => r.status === 'online').length;
  const offline = results.filter((r) => r.status === 'offline').length;
  const degraded = results.filter((r) => r.status === 'degraded').length;
  const latencies = results.map((r) => r.latencyMs).filter((v) => v != null).sort((a, b) => a - b);
  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

  insertStmt.run({
    at: new Date().toISOString(),
    total,
    online,
    offline,
    degraded,
    avgLatencyMs,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    maxLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1] : null,
  });
}

export function pruneNetworkHistory(retentionHours) {
  const cutoff = new Date(Date.now() - retentionHours * 3600 * 1000).toISOString();
  pruneStmt.run(cutoff);
}

export function getNetworkHistory(hours = 24) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  return rangeStmt.all(since);
}
