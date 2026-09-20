import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { devicesRouter } from './routes/devices.js';
import { alertsRouter } from './routes/alerts.js';
import { publicRouter } from './routes/public.js';
import { settingsRouter } from './routes/settings.js';
import { usersRouter } from './routes/users.js';
import { statsRouter } from './routes/stats.js';
import { historyRouter } from './routes/history.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { startMonitorLoop } from './services/monitorService.js';
import { startExecutiveReportScheduler } from './services/executiveReportScheduler.js';
import { listDevices } from './services/devicesService.js';
import './db/sqlite.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

// Logo enviado via upload — serve estático, sem autenticação (é só uma
// imagem de marca, exibida inclusive no painel público e na tela de login).
app.use('/api/uploads', express.static(path.resolve('data/uploads')));

app.use('/api/auth', authRouter);
// Rota pública (sem autenticação) precisa vir ANTES do requireAuth abaixo,
// que protege todo o restante de /api.
app.use('/api/public', publicRouter);
app.use('/api/settings', requireAuth, requireAdmin, settingsRouter);
app.use('/api/users', requireAuth, requireAdmin, usersRouter);
app.use('/api/devices', requireAuth, devicesRouter);
app.use('/api/alerts', requireAuth, alertsRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/history', requireAuth, historyRouter);

// Serve o próprio frontend buildado (frontend/dist, pasta irmã de backend/),
// quando presente — assim um único processo Node atende tudo (API, WS e a
// interface web) numa porta só, sem precisar de Nginx/Apache na frente.
// Em desenvolvimento (frontend rodando via `vite dev` em outra porta) essa
// pasta simplesmente não existe e isso não faz nada.
const frontendDist = path.resolve(process.env.FRONTEND_DIST_PATH || path.join(process.cwd(), '../frontend/dist'));
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/ws).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  console.log(`[ip-dashboard-backend] servindo frontend estático de ${frontendDist}`);
}

const server = http.createServer(app);

// --- WebSocket: push do status de todos os dispositivos a cada rodada de
// monitoramento, para a tela atualizar sem esperar o próximo polling. ---
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', payload: true }));
});

// Escuta em todas as interfaces (0.0.0.0) de propósito: o painel deve ficar
// acessível tanto pela rede local quanto por uma interface Tailscale/VPN já
// configurada na máquina — não há necessidade de configuração extra de rede
// além do que o Tailscale já provê, só abrir esta porta no firewall se
// houver um (ver README).
startMonitorLoop((results) => {
  if (wss.clients.size === 0) return;
  broadcast('devices:update', results);
});
startExecutiveReportScheduler();

server.listen(config.port, '0.0.0.0', () => {
  const total = listDevices().length;
  console.log(`[ip-dashboard-backend] ouvindo em http://0.0.0.0:${config.port} (${total} dispositivos cadastrados)`);
});
