import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { runBackup, listBackups, backupFilePath, deleteBackup, scheduleRestore } from '../services/backupService.js';
import { logAudit } from '../services/auditService.js';

export const backupRouter = Router();

const uploadsTmpDir = path.resolve('data/uploads-tmp');
if (!fs.existsSync(uploadsTmpDir)) fs.mkdirSync(uploadsTmpDir, { recursive: true });
const upload = multer({ dest: uploadsTmpDir, limits: { fileSize: 200 * 1024 * 1024 } });

// Reinicia o processo pra completar a restauração agendada (ver
// scheduleRestore/sqlite.js) — Restart=on-failure no systemd exige um código
// de saída != 0 pra subir de novo; um pequeno delay garante que a resposta
// HTTP já foi enviada antes do processo cair.
function restartToApplyRestore() {
  setTimeout(() => process.exit(1), 500);
}

backupRouter.get('/', (req, res) => {
  res.json({ data: listBackups() });
});

backupRouter.post('/run', async (req, res) => {
  try {
    const name = await runBackup();
    logAudit({ username: req.user?.username, action: 'backup.manual', details: `Backup manual criado: ${name}` });
    res.status(201).json({ name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

backupRouter.get('/:name/download', (req, res) => {
  const filePath = backupFilePath(req.params.name);
  if (!filePath) return res.status(404).json({ error: 'Backup não encontrado.' });
  res.download(filePath, req.params.name);
});

backupRouter.delete('/:name', (req, res) => {
  const filePath = backupFilePath(req.params.name);
  if (!filePath) return res.status(404).json({ error: 'Backup não encontrado.' });
  deleteBackup(req.params.name);
  logAudit({ username: req.user?.username, action: 'backup.delete', details: `Backup removido: ${req.params.name}` });
  res.status(204).end();
});

// Restaura a partir de um backup já existente no servidor (gerado por este
// mesmo painel, manual ou automático).
backupRouter.post('/:name/restore', (req, res) => {
  const filePath = backupFilePath(req.params.name);
  if (!filePath) return res.status(404).json({ error: 'Backup não encontrado.' });
  try {
    scheduleRestore(filePath);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  logAudit({ username: req.user?.username, action: 'backup.restore', details: `Restauração agendada a partir de "${req.params.name}" — backend reiniciando` });
  res.json({ ok: true, message: 'Restauração agendada — o backend vai reiniciar em instantes.' });
  restartToApplyRestore();
});

// Restaura a partir de um arquivo .db.gz enviado pelo navegador (ex.: backup
// baixado de outro servidor, ou salvo antes desse recurso existir).
backupRouter.post('/restore-upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de backup (.db.gz).' });
  try {
    scheduleRestore(req.file.path);
  } catch (err) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: err.message });
  }
  fs.unlinkSync(req.file.path);
  logAudit({ username: req.user?.username, action: 'backup.restore', details: 'Restauração agendada a partir de upload — backend reiniciando' });
  res.json({ ok: true, message: 'Restauração agendada — o backend vai reiniciar em instantes.' });
  restartToApplyRestore();
});
