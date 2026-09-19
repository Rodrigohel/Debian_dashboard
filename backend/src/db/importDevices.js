import fs from 'node:fs';
import { parseCsv } from '../utils/csv.js';
import { upsertDeviceByIp } from '../services/devicesService.js';

/**
 * Importa dispositivos em massa de um CSV (colunas: ip,name,type,location,ports,notes).
 * Uso: node src/db/importDevices.js caminho/para/dispositivos.csv
 * Cria os que não existem (por IP) e atualiza os que já existem.
 */
function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node src/db/importDevices.js <arquivo.csv>');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  if (rows.length === 0) {
    console.error('Nenhuma linha encontrada no CSV (confira o cabeçalho: ip,name,type,location,ports,notes).');
    process.exit(1);
  }

  let processed = 0, failed = 0;
  for (const row of rows) {
    try {
      upsertDeviceByIp({
        ip: row.ip,
        name: row.name,
        type: row.type,
        location: row.location,
        ports: row.ports,
        notes: row.notes,
      });
      console.log(`OK  ${row.ip} — ${row.name || row.ip}`);
      processed += 1;
    } catch (err) {
      failed += 1;
      console.error(`ERRO ${row.ip || '(sem ip)'} — ${err.message}`);
    }
  }

  console.log(`\nImportação concluída: ${processed} processados, ${failed} com erro.`);
}

main();
