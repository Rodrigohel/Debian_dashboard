import { getSettings, setSettings } from './settingsService.js';
import { runBackup, deleteOldBackups } from './backupService.js';
import { logAudit } from './auditService.js';

const CHECK_INTERVAL_MS = 3600000; // checa 1x por hora, igual ao relatório executivo
const ONE_DAY_MS = 86400000;

async function checkAndRun() {
  const settings = getSettings();
  if (settings.backupEnabled === 'false') return;

  const lastAt = settings.backupLastAt ? new Date(settings.backupLastAt).getTime() : 0;
  if (Date.now() - lastAt < ONE_DAY_MS) return;

  try {
    const name = await runBackup();
    deleteOldBackups(Number(settings.backupRetentionDays) || 14);
    setSettings({ backupLastAt: new Date().toISOString() });
    logAudit({ username: 'sistema', action: 'backup.auto', details: `Backup automático criado: ${name}` });
  } catch (err) {
    console.error('[backup] falha no backup automático:', err.message);
  }
}

// Mesmo padrão do executiveReportScheduler: checa a cada hora se já passou
// um dia desde o último backup, em vez de um cron exato — resiliente a
// reinícios do backend (não perde o backup do dia se o processo cair na
// hora certa).
export function startBackupScheduler() {
  checkAndRun();
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
}
