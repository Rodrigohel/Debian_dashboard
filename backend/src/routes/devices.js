import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/auth.js';
import {
  listDevices, getDevice, createDevice, updateDevice, deleteDevice, upsertDeviceByIp, getSummary, setFavorite,
  setMaintenance, setFloorPosition, DEVICE_TYPES,
} from '../services/devicesService.js';
import { scanNetwork } from '../services/scanService.js';
import { getDeviceUptimeHeatmap } from '../services/eventsService.js';
import { runMonitorCycle } from '../services/monitorService.js';
import { identifyDevice, identifyDevices } from '../services/identifyService.js';
import { getSettings } from '../services/settingsService.js';
import { streamDevicesPdf } from '../services/pdfReportService.js';
import { config } from '../config.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { logAudit } from '../services/auditService.js';

export const devicesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

devicesRouter.get('/', (req, res) => {
  const { type, status, q } = req.query;
  let devices = listDevices();
  if (type) devices = devices.filter((d) => d.type === type);
  if (status) devices = devices.filter((d) => d.status === status);
  if (q) {
    const needle = String(q).toLowerCase();
    devices = devices.filter((d) => d.name.toLowerCase().includes(needle) || d.ip.includes(needle) || d.location.toLowerCase().includes(needle));
  }
  res.json({ data: devices, types: DEVICE_TYPES });
});

devicesRouter.get('/summary', (req, res) => {
  res.json(getSummary());
});

devicesRouter.get('/export', (req, res) => {
  const devices = listDevices();
  const rows = devices.map((d) => ({ ...d, ports: d.ports.join(';') }));
  const csv = toCsv(rows, ['ip', 'name', 'type', 'location', 'ports', 'mac', 'vendor', 'model', 'notes']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dispositivos.csv"');
  res.send(csv);
});

devicesRouter.get('/export/pdf', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="dispositivos.pdf"');
  streamDevicesPdf(res);
});

// Roda MAC (via ARP) + fabricante (OUI) + best-effort marca/modelo (ONVIF,
// SSDP/UPnP, interface web) em todos os dispositivos de uma vez — o botão
// "Identificar tudo" depois de um "Escanear rede", que só descobre IPs.
devicesRouter.post('/identify-all', requireAdmin, async (req, res) => {
  try {
    const results = await identifyDevices(Array.isArray(req.body?.ids) ? req.body.ids : null);
    res.json({
      processed: results.length,
      // Um dispositivo offline no momento não tem como ter o MAC lido (a
      // tabela ARP só existe para quem responde) — não é falha do painel.
      withMac: results.filter((d) => d.mac).length,
      withVendor: results.filter((d) => d.vendor).length,
      withModel: results.filter((d) => d.model).length,
      offline: results.filter((d) => d.status === 'offline').length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

devicesRouter.get('/:id', (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  res.json(device);
});

devicesRouter.post('/', requireAdmin, (req, res) => {
  try {
    const device = createDevice(req.body || {});
    logAudit({ username: req.user?.username, action: 'device.create', details: `Dispositivo "${device.name}" (${device.ip}) criado` });
    res.status(201).json(device);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

devicesRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    const device = updateDevice(Number(req.params.id), req.body || {});
    logAudit({ username: req.user?.username, action: 'device.update', details: `Dispositivo "${device.name}" (${device.ip}) atualizado` });
    res.json(device);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

devicesRouter.delete('/:id', requireAdmin, (req, res) => {
  const device = getDevice(Number(req.params.id));
  deleteDevice(Number(req.params.id));
  if (device) logAudit({ username: req.user?.username, action: 'device.delete', details: `Dispositivo "${device.name}" (${device.ip}) removido` });
  res.status(204).end();
});

devicesRouter.get('/:id/uptime-heatmap', (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  const days = Math.min(Number(req.query.days) || 90, 365);
  res.json({ data: getDeviceUptimeHeatmap(device.id, days) });
});

devicesRouter.post('/:id/favorite', (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  res.json(setFavorite(device.id, req.body?.favorite !== false));
});

// `until: null` (ou ausente) encerra a manutenção imediatamente.
devicesRouter.post('/:id/maintenance', requireAdmin, (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  const until = req.body?.until || null;
  if (until && Number.isNaN(new Date(until).getTime())) {
    return res.status(400).json({ error: 'Data inválida.' });
  }
  const updated = setMaintenance(device.id, until);
  logAudit({
    username: req.user?.username,
    action: 'device.maintenance',
    details: until
      ? `"${device.name}" colocado em manutenção até ${new Date(until).toLocaleString('pt-BR')}`
      : `Manutenção encerrada para "${device.name}"`,
  });
  res.json(updated);
});

// `floorId`/`x`/`y` todos null remove o dispositivo de qualquer planta
// baixa; com valores, `floorId` precisa ser um pavimento existente e `x`/`y`
// entre 0 e 1 (posição relativa à imagem, não pixels — assim a planta pode
// ser reenviada em outra resolução sem precisar reposicionar tudo de novo).
devicesRouter.post('/:id/floor-position', requireAdmin, (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  const { floorId, x, y } = req.body || {};
  if (floorId === null && x === null && y === null) return res.json(setFloorPosition(device.id, null, null, null));
  if (typeof floorId !== 'number' || typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 1 || y < 0 || y > 1) {
    return res.status(400).json({ error: 'Posição inválida (floorId numérico e x/y entre 0 e 1).' });
  }
  res.json(setFloorPosition(device.id, floorId, x, y));
});

// Verificação avulsa de um dispositivo específico, sem esperar a próxima
// rodada do loop de monitoramento (ex.: botão "Testar agora" no detalhe).
devicesRouter.post('/:id/check', requireAdmin, async (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  await runMonitorCycle();
  res.json(getDevice(device.id));
});

// Identifica um único dispositivo (MAC/fabricante/modelo) sob demanda —
// botão "Identificar agora" no detalhe.
devicesRouter.post('/:id/identify', requireAdmin, async (req, res) => {
  const device = getDevice(Number(req.params.id));
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
  try {
    res.json(await identifyDevice(device));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

devicesRouter.post('/import', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo CSV.' });
  const rows = parseCsv(req.file.buffer.toString('utf8'));
  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV vazio ou sem cabeçalho reconhecido (ip,name,type,location,ports,notes — mac/vendor/model são opcionais e normalmente descobertos automaticamente).' });
  }
  let processed = 0;
  const errors = [];
  for (const row of rows) {
    try {
      upsertDeviceByIp(row);
      processed += 1;
    } catch (err) {
      errors.push({ ip: row.ip, error: err.message });
    }
  }
  logAudit({ username: req.user?.username, action: 'device.import', details: `Importação CSV: ${processed} processados, ${errors.length} erros` });
  res.json({ processed, errors });
});

devicesRouter.post('/scan', requireAdmin, async (req, res) => {
  const base = req.body?.base || getSettings().networkBase || config.networkBase;
  const start = Number(req.body?.start) || 1;
  const end = Number(req.body?.end) || 254;
  if (end - start > 512) {
    return res.status(400).json({ error: 'Faixa de varredura grande demais (máximo 512 IPs por vez).' });
  }
  try {
    const result = await scanNetwork({ base, start, end });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
