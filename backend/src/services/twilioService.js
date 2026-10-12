import { getSettings } from './settingsService.js';

// TwiML fixo embutido direto na chamada (parâmetro `Twiml`, suportado pela
// API de criação de chamada do Twilio) — evita expor um endpoint público
// novo no servidor só pra responder o webhook de instrução da ligação.
// Toca 1s de silêncio e desliga: a pessoa só precisa VER que ligou, não
// precisa ouvir nada (pedido explícito — "só chamar, não preciso falar").
const SILENT_TWIML = '<Response><Pause length="1"/><Hangup/></Response>';

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

// Ligação de alerta — opcional, só dispara se tudo estiver configurado e
// ligado em Configurações → Notificações (equipamento crítico, offline).
export async function makeCriticalCall() {
  const {
    twilioCallEnabled, twilioAccountSid: accountSid, twilioAuthToken: authToken,
    twilioFromNumber: fromNumber, twilioToNumberCritical: toNumber,
  } = getSettings();
  if (twilioCallEnabled !== 'true') return;
  if (!accountSid || !authToken || !fromNumber || !toNumber) return;

  const result = await makeTwilioCallWith(accountSid, authToken, fromNumber, toNumber);
  if (!result.ok) {
    console.error('[twilio] falha ao ligar para alerta crítico:', result.error);
  }
}
