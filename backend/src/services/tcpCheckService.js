import net from 'node:net';

export function checkTcpPort(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    }
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, ip);
  });
}

// true se PELO MENOS UMA das portas configuradas responder — um dispositivo
// com várias portas (ex.: HTTP e RTSP) só está "degradado" se todas caírem.
export async function checkAnyTcpPort(ip, ports, timeoutMs) {
  if (!ports || ports.length === 0) return null; // sem portas configuradas: não se aplica
  const results = await Promise.all(ports.map((port) => checkTcpPort(ip, port, timeoutMs)));
  return results.some(Boolean);
}
