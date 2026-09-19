import { pingHost } from './pingService.js';
import { runWithConcurrency } from './monitorService.js';
import { upsertDeviceByIp, listDevices } from './devicesService.js';

/**
 * Varredura de ping no prefixo /24 (ex.: "192.168.1", .1 a .254) para achar
 * IPs ativos na rede que ainda não estão cadastrados — útil para dar o
 * pontapé inicial no cadastro de ~230 dispositivos sem digitar tudo à mão.
 * Os que já respondem e não estão cadastrados entram como tipo "outro" para
 * o usuário depois classificar (nome, tipo, local) pela tela.
 */
export async function scanNetwork({ base, start = 1, end = 254, timeoutMs = 800, concurrency = 40 }) {
  const known = new Set(listDevices().map((d) => d.ip));
  const candidates = [];
  for (let i = start; i <= end; i++) candidates.push(`${base}.${i}`);

  const found = [];
  await runWithConcurrency(candidates, concurrency, async (ip) => {
    const result = await pingHost(ip, timeoutMs);
    if (result.ok) found.push({ ip, latencyMs: result.latencyMs, alreadyKnown: known.has(ip) });
  });

  const created = [];
  for (const item of found) {
    if (item.alreadyKnown) continue;
    try {
      const device = upsertDeviceByIp({ ip: item.ip, name: `Dispositivo ${item.ip}`, type: 'outro', location: '' });
      created.push(device);
    } catch {
      // corrida rara (mesmo IP criado por outra chamada concorrente) — ignora
    }
  }

  found.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
  return { scanned: candidates.length, respondingCount: found.length, responding: found, createdCount: created.length, created };
}
