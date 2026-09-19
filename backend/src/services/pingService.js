import { execFile } from 'node:child_process';

// Usa o binário `ping` do sistema em vez de um pacote npm de ICMP raw-socket:
// no Debian, `iputils-ping` já roda sem privilégio root (via capability
// cap_net_raw no binário), então isso funciona com o backend rodando como
// usuário comum — nenhum socket raw dentro do próprio Node, nenhum sudo.
const LATENCY_RE = /time[=<]([\d.]+)\s*ms/i;

export function pingHost(ip, timeoutMs) {
  return new Promise((resolve) => {
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
    execFile('ping', ['-c', '1', '-W', String(timeoutSec), ip], { timeout: timeoutMs + 500 }, (err, stdout) => {
      if (err) {
        resolve({ ok: false, latencyMs: null });
        return;
      }
      const match = LATENCY_RE.exec(stdout);
      resolve({ ok: true, latencyMs: match ? Number(match[1]) : null });
    });
  });
}
