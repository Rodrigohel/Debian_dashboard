import dgram from 'node:dgram';
import http from 'node:http';
import crypto from 'node:crypto';

// Envia um datagrama UDP diretamente para `ip:port` (unicast, não multicast)
// e devolve a primeira resposta recebida dentro do timeout. SSDP e
// WS-Discovery são desenhados para multicast, mas a grande maioria das
// implementações (câmeras, NVRs, roteiros) responde a quem mandou o pacote
// não importa se veio por unicast ou multicast — na prática isso permite
// "perguntar" a um IP específico em vez de descobrir a rede inteira.
function udpProbe(ip, port, message, timeoutMs) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let done = false;
    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      resolve(result);
    }
    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.on('error', () => finish(null));
    socket.on('message', (msg) => finish(msg.toString('utf8')));
    socket.send(message, port, ip, (err) => { if (err) finish(null); });
  });
}

function parseHeaders(raw) {
  const headers = {};
  for (const line of raw.split('\r\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function fetchText(url, timeoutMs) {
  return new Promise((resolve) => {
    let req;
    try {
      req = http.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', (c) => { if (body.length < 16384) body += c; });
        res.on('end', () => resolve(body));
      });
    } catch {
      resolve(null);
      return;
    }
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

function xmlTag(body, tag) {
  const match = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i').exec(body);
  return match ? match[1].trim() : null;
}

/**
 * SSDP (UPnP): muitos NVRs, roteadores e dispositivos de rede anunciam a si
 * mesmos por esse protocolo. A resposta ao M-SEARCH traz um cabeçalho
 * LOCATION apontando para um XML de descrição com fabricante/modelo.
 */
export async function ssdpProbe(ip, timeoutMs = 1500) {
  const message = [
    'M-SEARCH * HTTP/1.1',
    'HOST: 239.255.255.250:1900',
    'MAN: "ssdp:discover"',
    'MX: 1',
    'ST: ssdp:all',
    '', '',
  ].join('\r\n');

  const raw = await udpProbe(ip, 1900, message, timeoutMs);
  if (!raw) return null;
  const headers = parseHeaders(raw.split('\r\n').slice(1).join('\r\n'));
  const result = { server: headers.server || null, location: headers.location || null };

  if (headers.location) {
    const body = await fetchText(headers.location, timeoutMs);
    if (body) {
      result.manufacturer = xmlTag(body, 'manufacturer');
      result.model = xmlTag(body, 'modelName') || xmlTag(body, 'modelNumber');
      result.friendlyName = xmlTag(body, 'friendlyName');
    }
  }
  return result;
}

/**
 * WS-Discovery (ONVIF): padrão usado pela maioria das câmeras IP e NVRs
 * profissionais (Hikvision, Dahua, Intelbras, Axis...) para se anunciarem
 * na rede. O campo Scopes costuma trazer o modelo do equipamento
 * (ex.: "onvif://www.onvif.org/hardware/NVR304-08P").
 */
export async function onvifProbe(ip, timeoutMs = 1500) {
  const messageId = crypto.randomUUID();
  const message = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>uuid:${messageId}</w:MessageID><w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body>
</e:Envelope>`;

  const raw = await udpProbe(ip, 3702, message, timeoutMs);
  if (!raw) return null;

  const scopes = xmlTag(raw, 'd:Scopes') || xmlTag(raw, 'Scopes') || '';
  const hardwareMatch = /onvif:\/\/www\.onvif\.org\/hardware\/(\S+)/i.exec(scopes);
  const nameMatch = /onvif:\/\/www\.onvif\.org\/name\/([^\s<]+)/i.exec(scopes);
  const xaddrs = xmlTag(raw, 'd:XAddrs') || xmlTag(raw, 'XAddrs');

  return {
    model: hardwareMatch ? decodeURIComponent(hardwareMatch[1]) : null,
    friendlyName: nameMatch ? decodeURIComponent(nameMatch[1].replace(/_/g, ' ')) : null,
    xaddrs: xaddrs || null,
  };
}
