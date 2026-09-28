import { pingHost } from './pingService.js';
import { runWithConcurrency } from './monitorService.js';
import { upsertDeviceByIp, listDevices } from './devicesService.js';
import { identifyDevices } from './identifyService.js';

/**
 * Varredura de ping em um ou mais prefixos /24 (ex.: "192.168.1", .1 a .254;
 * ou "192.168.1,192.168.20" pra varrer várias sub-redes/VLANs de uma vez)
 * para achar IPs ativos na rede que ainda não estão cadastrados — útil para
 * dar o pontapé inicial no cadastro de ~230 dispositivos sem digitar tudo à
 * mão. Os que já respondem e não estão cadastrados entram como tipo "outro"
 * para o usuário depois classificar (nome, tipo, local) pela tela.
 */
export async function scanNetwork({ base, start = 1, end = 254, timeoutMs = 800, concurrency = 40 }) {
  const bases = String(base || '').split(',').map((b) => b.trim()).filter(Boolean);
  if (bases.length === 0) throw new Error('Informe ao menos um prefixo de rede (ex.: 192.168.1).');

  const known = new Set(listDevices().map((d) => d.ip));
  const found = [];
  let scanned = 0;

  // Um prefixo de cada vez (não em paralelo entre si) pra não somar a
  // concorrência de todos e sobrecarregar a rede/os próprios dispositivos
  // sendo monitorados ao mesmo tempo que a varredura roda.
  for (const prefixBase of bases) {
    const candidates = [];
    for (let i = start; i <= end; i++) candidates.push(`${prefixBase}.${i}`);
    scanned += candidates.length;
    await runWithConcurrency(candidates, concurrency, async (ip) => {
      const result = await pingHost(ip, timeoutMs);
      if (result.ok) found.push({ ip, latencyMs: result.latencyMs, alreadyKnown: known.has(ip) });
    });
  }

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

  // Identifica (MAC/fabricante/modelo) os recém-cadastrados na hora — assim
  // "Escanear rede" já entrega a lista pronta para classificar, em vez de
  // exigir um segundo clique em "Identificar tudo" logo em seguida.
  let identified = [];
  if (created.length > 0) {
    identified = await identifyDevices(created.map((d) => d.id));
  }

  return {
    scanned, respondingCount: found.length, responding: found,
    createdCount: created.length, created: identified.length > 0 ? identified : created,
  };
}
