import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';

const backupsDir = path.resolve('data/backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Usa a API de backup "online" do better-sqlite3 (mesma técnica do `.backup`
// do sqlite3 CLI): copia o banco de forma consistente mesmo em uso e em modo
// WAL, sem parar o monitoramento nem travar outras escritas.
export async function runBackup() {
  const tmpPath = path.join(backupsDir, `.tmp-${timestamp()}.db`);
  await db.backup(tmpPath);
  const finalName = `dashboard-${timestamp()}.db.gz`;
  await new Promise((resolve, reject) => {
    const src = fs.createReadStream(tmpPath);
    const dst = fs.createWriteStream(path.join(backupsDir, finalName));
    src.pipe(zlib.createGzip()).pipe(dst).on('finish', resolve).on('error', reject);
  });
  fs.unlinkSync(tmpPath);
  return finalName;
}

export function listBackups() {
  return fs.readdirSync(backupsDir)
    .filter((f) => f.endsWith('.db.gz'))
    .map((f) => {
      const stat = fs.statSync(path.join(backupsDir, f));
      return { name: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteOldBackups(retentionDays) {
  const cutoff = Date.now() - retentionDays * 86400000;
  for (const b of listBackups()) {
    if (new Date(b.createdAt).getTime() < cutoff) fs.unlinkSync(path.join(backupsDir, b.name));
  }
}

// Só aceita nomes exatamente no formato gerado por runBackup — evita path
// traversal a partir do parâmetro de rota.
export function backupFilePath(name) {
  if (!/^dashboard-[0-9TZ-]+\.db\.gz$/.test(name)) return null;
  const p = path.join(backupsDir, name);
  return fs.existsSync(p) ? p : null;
}

export function deleteBackup(name) {
  const p = backupFilePath(name);
  if (p) fs.unlinkSync(p);
}

// Grava o banco escolhido em restore-pending.db e valida que é um SQLite
// utilizável antes de aceitar — a troca de fato só acontece no próximo boot
// (ver sqlite.js), porque trocar o arquivo com a conexão atual aberta (e
// prepared statements de vários serviços apontando pra ela) não é seguro.
export function scheduleRestore(gzFilePath) {
  const dir = path.dirname(config.auth.sqlitePath);
  const pendingPath = path.join(dir, 'restore-pending.db');
  const buf = zlib.gunzipSync(fs.readFileSync(gzFilePath));
  fs.writeFileSync(pendingPath, buf);

  try {
    const check = new Database(pendingPath, { readonly: true });
    const hasDevicesTable = check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='devices'").get();
    check.close();
    if (!hasDevicesTable) throw new Error('sem a tabela "devices"');
  } catch (err) {
    fs.unlinkSync(pendingPath);
    throw new Error(`Arquivo de backup inválido ou corrompido (${err.message}).`);
  } finally {
    // A checagem acima (mesmo só de leitura) pode criar -wal/-shm ao lado —
    // limpa pra não deixar lixo se der certo, e sqlite.js não precisa lidar
    // com isso ao aplicar a restauração.
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${pendingPath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
  }
}
