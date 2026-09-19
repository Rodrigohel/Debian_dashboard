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
`);
