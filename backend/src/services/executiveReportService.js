import PDFDocument from 'pdfkit';
import { db } from '../db/sqlite.js';
import { listDevices, getSummary } from './devicesService.js';
import { getSettings } from './settingsService.js';
import { getFlappiestDevices, getDeviceUptime } from './eventsService.js';
import { getNetworkHistory } from './networkHistoryService.js';
import { TYPE_LABEL } from './labels.js';

const incidentCountStmt = db.prepare(`
  SELECT COUNT(*) AS c
  FROM device_events e
  JOIN devices d ON d.id = e.device_id
  WHERE e.event_type = 'went_offline' AND d.enabled = 1 AND e.at >= @since
`);

function periodIncidentCount(days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return incidentCountStmt.get({ since }).c;
}

// Uptime/tempo offline agregados da rede no período: média do % de cada
// dispositivo ativo (mesmo cálculo já usado no detalhe individual), pra não
// duplicar a lógica de reconstrução do histórico de eventos.
function networkUptimeAndDowntime(days) {
  const devices = listDevices().filter((d) => d.enabled);
  let uptimeSum = 0;
  let offlineMsSum = 0;
  for (const device of devices) {
    const u = getDeviceUptime(device.id, days);
    uptimeSum += u.uptimePercent;
    offlineMsSum += u.offlineMs;
  }
  return {
    avgUptime: devices.length > 0 ? uptimeSum / devices.length : 100,
    offlineMsSum,
  };
}

function latencyStats(days) {
  const rows = getNetworkHistory(days * 24);
  const avg = (key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  return { avg: avg('avgLatencyMs'), p95: avg('p95LatencyMs') };
}

function formatDuration(ms) {
  if (ms == null || ms <= 0) return '0 min';
  const hours = ms / 3600000;
  if (hours < 1) return `${Math.round(ms / 60000)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} dias`;
}

// Desenha o relatório num PDFDocument já criado — compartilhado entre a
// rota HTTP (`streamExecutiveReportPdf`, que faz `doc.pipe(res)`) e o envio
// automático por Telegram (`generateExecutiveReportBuffer`, que coleta os
// bytes em memória), pra não duplicar o layout entre os dois usos.
function drawExecutiveReport(doc, days) {
  const settings = getSettings();
  const summary = getSummary();
  const { avgUptime, offlineMsSum } = networkUptimeAndDowntime(days);
  const incidentCount = periodIncidentCount(days);
  const latency = latencyStats(days);
  const flappiest = getFlappiestDevices(days * 24, 5);

  const startX = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.fontSize(18).fillColor('#0F172A').text(settings.companyName, startX, doc.y);
  doc.fontSize(12).fillColor('#64748B').text(`${settings.siteName} — Relatório executivo (últimos ${days} dias)`);
  doc.fontSize(8.5).fillColor('#94A3B8').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`);
  doc.moveDown(1.1);

  const tiles = [
    { label: 'Uptime médio', value: `${avgUptime.toFixed(2)}%`, color: avgUptime >= 99 ? '#16A34A' : avgUptime >= 95 ? '#D97706' : '#DC2626' },
    { label: 'Incidentes no período', value: String(incidentCount), color: incidentCount === 0 ? '#16A34A' : '#DC2626' },
    { label: 'Tempo total offline', value: formatDuration(offlineMsSum), color: '#0F172A' },
    { label: 'Latência média / p95', value: latency.avg != null ? `${latency.avg.toFixed(0)} / ${latency.p95 != null ? latency.p95.toFixed(0) : '—'} ms` : '—', color: '#0F172A' },
  ];
  const gap = 10;
  const tileWidth = (pageWidth - gap * (tiles.length - 1)) / tiles.length;
  const tileY = doc.y;
  const tileHeight = 56;
  tiles.forEach((tile, i) => {
    const x = startX + i * (tileWidth + gap);
    doc.roundedRect(x, tileY, tileWidth, tileHeight, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fontSize(7.5).fillColor('#64748B').text(tile.label.toUpperCase(), x + 10, tileY + 10, { width: tileWidth - 20 });
    doc.fontSize(15).fillColor(tile.color).text(tile.value, x + 10, tileY + 25, { width: tileWidth - 20 });
  });
  doc.y = tileY + tileHeight + 24;

  doc.fontSize(12).fillColor('#0F172A').text('Situação atual por tipo de equipamento', startX, doc.y);
  doc.moveDown(0.5);
  const typeEntries = Object.entries(summary.byType);
  if (typeEntries.length === 0) {
    doc.fontSize(9.5).fillColor('#64748B').text('Nenhum dispositivo cadastrado.', startX, doc.y);
  } else {
    typeEntries.forEach(([type, counts]) => {
      doc.fontSize(9.5).fillColor('#334155').text(
        `${TYPE_LABEL[type] || type}: ${counts.total} total  —  ${counts.online || 0} online, ${counts.degraded || 0} degradado, ${counts.offline || 0} offline`,
        startX, doc.y,
      );
      doc.moveDown(0.2);
    });
  }
  doc.moveDown(0.8);

  doc.fontSize(12).fillColor('#0F172A').text('Dispositivos mais instáveis no período', startX, doc.y);
  doc.moveDown(0.5);
  if (flappiest.length === 0) {
    doc.fontSize(9.5).fillColor('#16A34A').text('Nenhuma queda registrada — rede estável no período.', startX, doc.y);
  } else {
    flappiest.forEach((d, i) => {
      doc.fontSize(9.5).fillColor('#334155').text(
        `${i + 1}. ${d.name} (${d.ip}, ${TYPE_LABEL[d.type] || d.type}) — ${d.drops} queda(s)`,
        startX, doc.y,
      );
      doc.moveDown(0.2);
    });
  }

  doc.fontSize(7.5).fillColor('#94A3B8').text(
    'Relatório gerado automaticamente pelo painel de monitoramento de rede.',
    startX, doc.page.height - doc.page.margins.bottom - 14,
  );
}

/**
 * Relatório executivo em PDF: um resumo de uma página pro período (uptime
 * médio, incidentes, latência, situação por tipo, top instáveis) — pensado
 * pra imprimir/anexar num e-mail de status pra síndico/gestor, sem precisar
 * abrir o painel. Complementa o relatório de dispositivos (lista completa
 * com MAC/fabricante/modelo) com uma visão de "como a rede se comportou".
 */
export function streamExecutiveReportPdf(res, { days = 7 } = {}) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-executivo-${days}d.pdf"`);
  doc.pipe(res);
  drawExecutiveReport(doc, days);
  doc.end();
}

// Mesmo relatório, mas coletado em memória como Buffer — usado pelo envio
// automático por Telegram (ver executiveReportScheduler.js), que precisa do
// arquivo pronto antes de anexar na chamada sendDocument.
export function generateExecutiveReportBuffer(days = 7) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawExecutiveReport(doc, days);
    doc.end();
  });
}
