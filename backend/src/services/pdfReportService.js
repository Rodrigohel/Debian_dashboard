import PDFDocument from 'pdfkit';
import { listDevices, getSummary } from './devicesService.js';
import { getSettings } from './settingsService.js';
import { TYPE_LABEL } from './labels.js';

const STATUS_LABEL = { online: 'Online', offline: 'Offline', degraded: 'Degradado', unknown: 'Verificando' };
const STATUS_COLOR = { online: '#16A34A', offline: '#DC2626', degraded: '#D97706', unknown: '#64748B' };

const COLUMNS = [
  { key: 'statusLabel', label: 'Status', width: 55 },
  { key: 'name', label: 'Nome', width: 115 },
  { key: 'ip', label: 'IP', width: 80 },
  { key: 'mac', label: 'MAC', width: 90 },
  { key: 'typeLabel', label: 'Tipo', width: 60 },
  { key: 'vendor', label: 'Fabricante', width: 115 },
  { key: 'model', label: 'Modelo', width: 90 },
  { key: 'location', label: 'Local', width: 90 },
];
const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);
const ROW_HEIGHT = 18;

function formatRow(device) {
  return {
    ...device,
    statusLabel: STATUS_LABEL[device.status] || device.status,
    typeLabel: TYPE_LABEL[device.type] || device.type,
    mac: device.mac || '—',
    vendor: device.vendor || '—',
    model: device.model || '—',
    location: device.location || '—',
  };
}

/**
 * Relatório em PDF de todos os dispositivos, agrupados por tipo e
 * fabricante — pensado pra imprimir ou anexar num e-mail/chamado, quando um
 * link pro painel não é prático. Gerado com `pdfkit` (puro JS, sem
 * dependência nativa nem Chromium) direto no stream de resposta HTTP.
 */
export function streamDevicesPdf(res, { companyName, siteName } = {}) {
  const settings = getSettings();
  const summary = getSummary();
  const devices = listDevices()
    .map(formatRow)
    .sort((a, b) => (
      a.typeLabel.localeCompare(b.typeLabel) ||
      a.vendor.localeCompare(b.vendor) ||
      a.ip.localeCompare(b.ip, undefined, { numeric: true })
    ));

  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  const startX = doc.page.margins.left;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  function drawTableHeader(y) {
    doc.rect(startX, y, TABLE_WIDTH, ROW_HEIGHT).fill('#1E293B');
    doc.fontSize(8.5).fillColor('#FFFFFF');
    let x = startX;
    for (const col of COLUMNS) {
      doc.text(col.label, x + 5, y + 5, { width: col.width - 6, lineBreak: false });
      x += col.width;
    }
    return y + ROW_HEIGHT;
  }

  function drawDocHeader() {
    doc.fontSize(17).fillColor('#0F172A').text(companyName || settings.companyName, startX, doc.y);
    doc.fontSize(11).fillColor('#64748B').text(`${siteName || settings.siteName} — Relatório de dispositivos`);
    doc.fontSize(8.5).fillColor('#94A3B8').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`);
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor('#0F172A').text(
      `Total: ${summary.total}    Online: ${summary.online}    Offline: ${summary.offline}    Degradado: ${summary.degraded}`,
    );
    doc.moveDown(0.8);
  }

  drawDocHeader();
  let y = drawTableHeader(doc.y);

  devices.forEach((device, i) => {
    if (y + ROW_HEIGHT > pageBottom) {
      doc.addPage();
      y = drawTableHeader(doc.page.margins.top);
    }
    if (i % 2 === 1) doc.rect(startX, y, TABLE_WIDTH, ROW_HEIGHT).fill('#F8FAFC');

    let x = startX;
    for (const col of COLUMNS) {
      const color = col.key === 'statusLabel' ? (STATUS_COLOR[device.status] || '#334155') : '#1E293B';
      doc.fontSize(8.5).fillColor(color).text(String(device[col.key] ?? ''), x + 5, y + 5, { width: col.width - 6, lineBreak: false });
      x += col.width;
    }
    y += ROW_HEIGHT;
  });

  if (devices.length === 0) {
    doc.fontSize(10).fillColor('#64748B').text('Nenhum dispositivo cadastrado.', startX, y + 8);
  }

  doc.end();
}
