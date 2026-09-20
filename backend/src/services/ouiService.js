import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Base oficial de fabricantes (IEEE OUI/MA-L/MA-M/MA-S), ~54 mil prefixos,
// mantida atualizada automaticamente pelo pacote `oui-data` — nenhuma
// atualização manual ou download em tempo de instalação é necessária.
const ouiData = require('oui-data');

// MA-M (7 hex) e MA-S (9 hex) são subdivisões de blocos MA-L (6 hex)
// atribuídos à "IEEE Registration Authority" — sempre tenta o prefixo mais
// específico primeiro (ver README do pacote oui-data).
export function lookupVendor(mac) {
  if (!mac) return null;
  const hex = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length < 6) return null;

  const entry = ouiData[hex.slice(0, 9)] ?? ouiData[hex.slice(0, 7)] ?? ouiData[hex.slice(0, 6)];
  if (!entry) return null;

  // A entrada traz nome + endereço em várias linhas — só o nome interessa.
  return entry.split('\n')[0].trim();
}
