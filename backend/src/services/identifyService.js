import { db } from '../db/sqlite.js';
import { readArpTable } from './macService.js';
import { lookupVendor } from './ouiService.js';
import { fingerprintHttp } from './httpFingerprintService.js';
import { ssdpProbe, onvifProbe } from './discoveryService.js';
import { runWithConcurrency } from './monitorService.js';
import { getDevice, listDevices } from './devicesService.js';

const updateStmt = db.prepare(`
  UPDATE devices SET mac = @mac, vendor = @vendor, model = @model, discovery_info = @discoveryInfo
  WHERE id = @id
`);

/**
 * Junta tudo que dá pra descobrir sobre um dispositivo sem precisar de
 * credencial nenhuma: MAC (via tabela ARP do kernel, populada pelo próprio
 * ping), fabricante a partir do MAC (base IEEE OUI) e, best-effort, marca e
 * modelo via WS-Discovery/ONVIF, SSDP/UPnP e a interface web do
 * equipamento. Nenhuma dessas fontes é garantida — cada dispositivo real
 * responde a um subconjunto diferente delas.
 */
export async function identifyDevice(device, { arpTable } = {}) {
  const arp = arpTable || await readArpTable();
  const mac = arp.get(device.ip) || device.mac || null;
  const vendorFromMac = lookupVendor(mac);

  const [httpInfo, ssdp, onvif] = await Promise.all([
    fingerprintHttp(device.ip, device.ports).catch(() => null),
    ssdpProbe(device.ip).catch(() => null),
    onvifProbe(device.ip).catch(() => null),
  ]);

  const model = onvif?.model || ssdp?.model || null;
  // O fabricante pelo MAC (registro oficial IEEE) é mais confiável que texto
  // livre de SSDP, então só cai para o SSDP quando o MAC não foi resolvido
  // (dispositivo ainda não respondeu a nenhum ping nesta sessão).
  const vendor = vendorFromMac || ssdp?.manufacturer || null;
  const friendlyName = onvif?.friendlyName || ssdp?.friendlyName || null;

  const result = {
    mac, vendor, model,
    discoveryInfo: { friendlyName, http: httpInfo, ssdp, onvif },
  };

  updateStmt.run({
    id: device.id,
    mac: result.mac || '',
    vendor: result.vendor || '',
    model: result.model || '',
    discoveryInfo: JSON.stringify(result.discoveryInfo),
  });

  return getDevice(device.id);
}

/**
 * Roda a identificação em vários dispositivos de uma vez (ex.: depois de um
 * "Escanear rede", que só sabe os IPs) com concorrência limitada — os
 * probes de rede (SSDP/ONVIF) usam sockets UDP, então um número mais baixo
 * de tarefas em paralelo do que o ping evita saturar a interface de rede.
 */
export async function identifyDevices(deviceIds, concurrency = 15) {
  const arpTable = await readArpTable();
  const devices = deviceIds
    ? deviceIds.map((id) => getDevice(id)).filter(Boolean)
    : listDevices().filter((d) => d.enabled);

  const results = [];
  await runWithConcurrency(devices, concurrency, async (device) => {
    try {
      results.push(await identifyDevice(device, { arpTable }));
    } catch (err) {
      console.error(`[identify] erro ao identificar ${device.ip}:`, err.message);
    }
  });
  return results;
}
