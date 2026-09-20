import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/auth.js';
import {
  listDevices, getDevice, createDevice, updateDevice, deleteDevice, upsertDeviceByIp, getSummary, DEVICE_TYPES,
} from '../services/devicesService.js';
import { scanNetwork } from '../services/scanService.js';
import { runMonitorCycle } from '../services/monitorService.js';
import { identifyDevice, identifyDevices } from '../services/identifyService.js';
import { config } from '../config.js';
import { parseCsv, toCsv } from '../utils/csv.js';

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

// Roda MAC (via ARP) + fabricante (OUI) + best-effort marca/modelo (ONVIF,
// SSDP/UPnP, interface web) em todos os dispositivos de uma vez — o botão
// "Identificar tudo" depois de um "Escanear rede", que só descobre IPs.
devicesRouter.post('/identify-all', requireAdmin, async (req, res) => {
  try {
    const results = await identifyDevices(Array.isArray(req.body?.ids) ? req.body.ids : null);
    res.json({ identified: results.length });
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
    res.status(201).json(createDevice(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

devicesRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    res.json(updateDevice(Number(req.params.id), req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

devicesRouter.delete('/:id', requireAdmin, (req, res) => {
  deleteDevice(Number(req.params.id));
  res.status(204).end();
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
  res.json({ processed, errors });
});

devicesRouter.post('/scan', requireAdmin, async (req, res) => {
  const base = req.body?.base || config.networkBase;
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
