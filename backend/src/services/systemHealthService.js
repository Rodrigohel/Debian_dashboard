import os from 'node:os';
import fs from 'node:fs/promises';

function round(n, decimals = 1) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/**
 * Saúde do próprio servidor Debian (CPU, memória, disco, uptime) — não tem
 * relação com os dispositivos monitorados, é sobre a máquina que roda o
 * painel. Usa só APIs nativas do Node (`node:os`, `fs.statfs`), sem
 * dependência externa nem `exec` de comandos do sistema.
 */
export async function getServerHealth() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const load = os.loadavg(); // [1min, 5min, 15min]

  let disk = null;
  try {
    const stats = await fs.statfs('/');
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    disk = {
      totalGb: round(totalBytes / 1e9),
      usedGb: round(usedBytes / 1e9),
      freeGb: round(freeBytes / 1e9),
      usedPercent: round((usedBytes / totalBytes) * 100),
    };
  } catch {
    // fs.statfs precisa de Node >=18.15 — se não disponível, só omite o disco
  }

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model?.trim() || null,
    loadAverage: { '1m': round(load[0], 2), '5m': round(load[1], 2), '15m': round(load[2], 2) },
    // Carga por núcleo é a leitura correta pra saber se está "pesado" de
    // verdade — load average de 4 numa máquina de 8 núcleos é tranquilo,
    // na mesma máquina com 2 núcleos já seria saturação.
    loadPercent: round(Math.min(100, (load[0] / cpus.length) * 100)),
    memory: {
      totalGb: round(totalMem / 1e9, 2),
      usedGb: round(usedMem / 1e9, 2),
      freeGb: round(freeMem / 1e9, 2),
      usedPercent: round((usedMem / totalMem) * 100),
    },
    disk,
    systemUptimeSeconds: Math.floor(os.uptime()),
    processUptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
  };
}
