import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const dir = path.dirname(config.auth.sqlitePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(config.auth.sqlitePath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cadastro dos equipamentos da rede (NVR, câmera, porteiro, interfone,
  -- switch, AP, etc.) — a fonte da verdade sobre o que deve ser monitorado.
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'outro',
    location TEXT NOT NULL DEFAULT '',
    ports TEXT NOT NULL DEFAULT '[]', -- JSON: portas TCP a checar além do ping (ex.: [80,554])
    notes TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    mac TEXT NOT NULL DEFAULT '',            -- descoberto via tabela ARP (ver macService)
    vendor TEXT NOT NULL DEFAULT '',         -- fabricante a partir do MAC (base IEEE OUI)
    model TEXT NOT NULL DEFAULT '',          -- modelo, via ONVIF/SSDP/HTTP (best-effort)
    discovery_info TEXT NOT NULL DEFAULT '{}', -- JSON bruto com tudo que os probes acharam
    device_username TEXT NOT NULL DEFAULT '',     -- login de acesso ao próprio equipamento
    device_password_enc TEXT NOT NULL DEFAULT '', -- senha de acesso, criptografada (ver cryptoService)
    favorite INTEGER NOT NULL DEFAULT 0,
    maintenance_until TEXT,                        -- ISO datetime: enquanto no futuro, suprime alertas/Telegram
    floor_x REAL,                                  -- posição na planta baixa (0-1, relativo à imagem)
    floor_y REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Último estado conhecido de cada dispositivo, persistido para sobreviver
  -- a reinícios do backend (sem isso, "offline há quanto tempo" resetaria
  -- toda vez que o processo reinicia).
  CREATE TABLE IF NOT EXISTS device_status (
    device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unknown', -- 'online' | 'degraded' | 'offline' | 'unknown'
    latency_ms REAL,
    last_check_at TEXT,
    last_online_at TEXT,
    last_offline_at TEXT,
    consecutive_fails INTEGER NOT NULL DEFAULT 0
  );

  -- Histórico de checagens recentes (ping ok/falha + latência), usado para o
  -- sparkline de latência no detalhe do dispositivo. Tabela é podada
  -- periodicamente (ver monitorService) para não crescer sem limite com
  -- ~230 dispositivos sendo checados a cada poucos segundos.
  CREATE TABLE IF NOT EXISTS device_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    at TEXT NOT NULL,
    ok INTEGER NOT NULL,
    latency_ms REAL
  );
  CREATE INDEX IF NOT EXISTS idx_device_checks_device ON device_checks(device_id, at DESC);

  -- Histórico de transições online/offline/degradado por dispositivo, para
  -- o log de eventos no detalhe e para "caiu Nx hoje".
  CREATE TABLE IF NOT EXISTS device_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'went_offline' | 'went_online' | 'degraded'
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_device_events_device ON device_events(device_id, at DESC);

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    source_key TEXT,
    last_notified_at TEXT,
    notified_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Uma linha por rodada de monitoramento, com a contagem geral da rede —
  -- alimenta o gráfico de "saúde da rede ao longo do tempo". Podada
  -- periodicamente (ver monitorService), então cresce de forma limitada.
  CREATE TABLE IF NOT EXISTS network_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    total INTEGER NOT NULL,
    online INTEGER NOT NULL,
    offline INTEGER NOT NULL,
    degraded INTEGER NOT NULL,
    avg_latency_ms REAL,
    p50_latency_ms REAL, -- mediana da latência de todos os dispositivos naquela rodada
    p95_latency_ms REAL, -- percentil 95 (mostra os picos, sem deixar 1 outlier dominar como o máximo bruto)
    max_latency_ms REAL
  );
  CREATE INDEX IF NOT EXISTS idx_network_history_at ON network_history(at DESC);

  -- Pavimentos de um prédio (subsolo, térreo, garagem, 1º andar...) — cada
  -- um com sua própria imagem de planta baixa. Um dispositivo pertence a no
  -- máximo um pavimento por vez (ver devices.floor_id).
  CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migração leve: `CREATE TABLE IF NOT EXISTS` acima não adiciona colunas
// novas a um banco já existente — precisa de ALTER TABLE explícito. Isso
// permite atualizar o painel (git pull + restart) sem perder o cadastro de
// dispositivos já feito.
const deviceColumns = db.prepare('PRAGMA table_info(devices)').all().map((c) => c.name);
for (const [column, ddl] of [
  ['mac', "ALTER TABLE devices ADD COLUMN mac TEXT NOT NULL DEFAULT ''"],
  ['vendor', "ALTER TABLE devices ADD COLUMN vendor TEXT NOT NULL DEFAULT ''"],
  ['model', "ALTER TABLE devices ADD COLUMN model TEXT NOT NULL DEFAULT ''"],
  ['discovery_info', "ALTER TABLE devices ADD COLUMN discovery_info TEXT NOT NULL DEFAULT '{}'"],
  ['device_username', "ALTER TABLE devices ADD COLUMN device_username TEXT NOT NULL DEFAULT ''"],
  ['device_password_enc', "ALTER TABLE devices ADD COLUMN device_password_enc TEXT NOT NULL DEFAULT ''"],
  ['favorite', 'ALTER TABLE devices ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0'],
  ['maintenance_until', 'ALTER TABLE devices ADD COLUMN maintenance_until TEXT'],
  ['floor_x', 'ALTER TABLE devices ADD COLUMN floor_x REAL'],
  ['floor_y', 'ALTER TABLE devices ADD COLUMN floor_y REAL'],
  ['floor_id', 'ALTER TABLE devices ADD COLUMN floor_id INTEGER REFERENCES floors(id)'],
]) {
  if (!deviceColumns.includes(column)) db.exec(ddl);
}

// Migração única: a primeira versão da planta baixa usava uma imagem só
// (guardada em settings.floorPlanUrl) pra todos os dispositivos. Ao migrar
// pra múltiplos pavimentos, se já existir aquela imagem antiga e nenhum
// pavimento cadastrado ainda, cria um pavimento "Planta baixa" com ela e
// migra os dispositivos já posicionados pra esse pavimento — não perde o
// que a pessoa já tinha configurado.
const floorsCount = db.prepare('SELECT COUNT(*) AS c FROM floors').get().c;
if (floorsCount === 0) {
  const oldFloorPlan = db.prepare("SELECT value FROM settings WHERE key = 'floorPlanUrl'").get();
  if (oldFloorPlan?.value) {
    const info = db.prepare('INSERT INTO floors (name, image_url, sort_order) VALUES (?, ?, 0)').run('Planta baixa', oldFloorPlan.value);
    db.prepare('UPDATE devices SET floor_id = ? WHERE floor_x IS NOT NULL AND floor_y IS NOT NULL AND floor_id IS NULL').run(info.lastInsertRowid);
  }
}

const networkHistoryColumns = db.prepare('PRAGMA table_info(network_history)').all().map((c) => c.name);
for (const [column, ddl] of [
  ['p50_latency_ms', 'ALTER TABLE network_history ADD COLUMN p50_latency_ms REAL'],
  ['p95_latency_ms', 'ALTER TABLE network_history ADD COLUMN p95_latency_ms REAL'],
  ['max_latency_ms', 'ALTER TABLE network_history ADD COLUMN max_latency_ms REAL'],
]) {
  if (!networkHistoryColumns.includes(column)) db.exec(ddl);
}
