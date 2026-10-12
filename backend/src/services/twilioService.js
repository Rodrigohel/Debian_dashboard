import { getSettings } from './settingsService.js';

// TwiML fixo embutido direto na chamada (parâmetro `Twiml`, suportado pela
// API de criação de chamada do Twilio) — evita expor um endpoint público
// novo no servidor só pra responder o webhook de instrução da ligação.
// Toca 1s de silêncio e desliga: a pessoa só precisa VER que ligou, não dá
// pra "atender de verdade" — assim que atende, a ligação cai sozinha (pedido
// explícito: "quando atender, cai; sem atender, eu caio também").
const SILENT_TWIML = '<Response><Pause length="1"/><Hangup/></Response>';

// Aceita um ou vários números separados por vírgula (mesmo padrão já usado
// pro prefixo de rede em Configurações) — cada um vira uma chamada própria,
// todas disparadas em paralelo (não é conferência: telefonia não tem "uma
// ligação só que toca em vários aparelhos", cada número é sempre uma
// chamada independente).
export function parsePhoneNumbers(raw) {
  return String(raw || '').split(',').map((n) => n.trim()).filter(Boolean);
}

// Chamada com credenciais explícitas — usado tanto pelo alerta automático
// (credenciais já salvas) quanto pelo botão "Testar ligação" em
// Configurações (testa antes de salvar).
export async function makeTwilioCallWith(accountSid, authToken, fromNumber, toNumber) {
  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    return { ok: false, error: 'Account SID, Auth Token, número de origem e número de destino são obrigatórios.' };
  }

  try {
    const body = new URLSearchParams({ To: toNumber, From: fromNumber, Twiml: SILENT_TWIML });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message || 'Twilio recusou a ligação. Confira Account SID, Auth Token e os números.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Erro de rede ao tentar ligar pelo Twilio: ${err.message}` };
  }
}

// Liga pra todos os números configurados em paralelo (um por um, nenhum
// espera o outro) — usado tanto pelo alerta automático quanto pelo "Testar
// ligação". Retorna um resultado por número, pra quem chama decidir o que
// fazer com falha parcial (ex.: logar só os que falharam).
export async function makeTwilioCallsWith(accountSid, authToken, fromNumber, toNumbers) {
  const numbers = Array.isArray(toNumbers) ? toNumbers : parsePhoneNumbers(toNumbers);
  if (numbers.length === 0) {
    return [{ ok: false, error: 'Informe ao menos um número a ligar.', toNumber: null }];
  }
  return Promise.all(numbers.map(async (toNumber) => ({
    toNumber,
    ...(await makeTwilioCallWith(accountSid, authToken, fromNumber, toNumber)),
  })));
}

// Ligação de alerta — opcional, só dispara se tudo estiver configurado e
// ligado em Configurações → Notificações (equipamento crítico, offline).
export async function makeCriticalCall() {
  const {
    twilioCallEnabled, twilioAccountSid: accountSid, twilioAuthToken: authToken,
    twilioFromNumber: fromNumber, twilioToNumberCritical: toNumbers,
  } = getSettings();
  if (twilioCallEnabled !== 'true') return;
  if (!accountSid || !authToken || !fromNumber || !toNumbers) return;

  const results = await makeTwilioCallsWith(accountSid, authToken, fromNumber, toNumbers);
  for (const result of results) {
    if (!result.ok) console.error(`[twilio] falha ao ligar para ${result.toNumber || '(nenhum número)'}:`, result.error);
  }
}
