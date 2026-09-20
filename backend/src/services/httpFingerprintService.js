import http from 'node:http';
import https from 'node:https';

const DEFAULT_PORTS = [80, 8080, 443, 8000, 8081, 88];
const MAX_BODY_BYTES = 8192;

function probeOnce(ip, port, useHttps, timeoutMs) {
  return new Promise((resolve) => {
    const client = useHttps ? https : http;
    const req = client.get({
      host: ip,
      port,
      path: '/',
      timeout: timeoutMs,
      rejectUnauthorized: false, // câmeras/NVRs quase sempre usam certificado autoassinado
      headers: { 'User-Agent': 'ip-dashboard-monitor' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        if (body.length < MAX_BODY_BYTES) body += chunk.toString('utf8', 0, MAX_BODY_BYTES - body.length);
        else res.destroy();
      });
      res.on('end', () => finish());
      res.on('close', () => finish());
      function finish() {
        const titleMatch = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(body);
        resolve({
          port, https: useHttps, statusCode: res.statusCode,
          server: res.headers.server || null,
          wwwAuthenticate: res.headers['www-authenticate'] || null,
          title: titleMatch ? titleMatch[1].trim() : null,
        });
      }
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

/**
 * Tenta identificar o dispositivo pela interface web (título da página,
 * cabeçalho Server, realm de autenticação — muitas câmeras/NVRs expõem o
 * fabricante/modelo em algum desses campos mesmo sem login). Best-effort:
 * tenta as portas configuradas no dispositivo e, se nenhuma, uma lista de
 * portas HTTP comuns; para no primeiro sucesso.
 */
export async function fingerprintHttp(ip, ports, timeoutMs = 1500) {
  const candidates = ports && ports.length > 0 ? ports : DEFAULT_PORTS;
  for (const port of candidates) {
    const result = await probeOnce(ip, port, port === 443, timeoutMs);
    if (result) return result;
  }
  return null;
}
