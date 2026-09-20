import fs from 'node:fs/promises';

const INCOMPLETE_MAC = '00:00:00:00:00:00';
// ATF_COM (0x2): entrada resolvida de verdade. Sem essa flag o kernel só
// tem uma entrada "pendente" (ainda tentando resolver, ou nunca respondeu),
// e o campo HW address vem zerado — não é um MAC de verdade.
const COMPLETE_FLAG = '0x2';

/**
 * Lê a tabela ARP do kernel (populada automaticamente pelo próprio ping —
 * qualquer host que responde ICMP também aparece aqui com o MAC resolvido)
 * e devolve um mapa IP -> MAC. Só funciona para hosts na mesma rede local
 * (mesmo segmento L2), que é exatamente o caso dos ~230 IPs fixos da rede.
 */
export async function readArpTable() {
  const map = new Map();
  let text;
  try {
    text = await fs.readFile('/proc/net/arp', 'utf8');
  } catch {
    return map; // não-Linux ou sem acesso — MAC simplesmente não é preenchido
  }

  const lines = text.split('\n').slice(1); // primeira linha é o cabeçalho
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6) continue;
    const [ip, , flags, mac] = cols;
    if (flags !== COMPLETE_FLAG) continue;
    if (!mac || mac === INCOMPLETE_MAC) continue;
    map.set(ip, mac.toLowerCase());
  }
  return map;
}
