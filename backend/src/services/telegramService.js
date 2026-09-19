import { getSettings } from './settingsService.js';

// Envia uma mensagem com credenciais explícitas (usado tanto pelo monitor,
// com o token salvo, quanto pelo botão "Testar notificação" em
// Configurações, que precisa testar um token antes de ser salvo).
export async function sendTelegramMessageWith(botToken, chatId, text) {
  if (!botToken || !chatId) return { ok: false, error: 'Bot Token e Chat ID são obrigatórios.' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let error = 'Telegram recusou a mensagem. Confira o Bot Token e o Chat ID.';
      try {
        const parsed = JSON.parse(body);
        if (parsed.description) error = parsed.description;
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Erro de rede ao tentar falar com o Telegram.' };
  }
}

// Notificação de alertas via Telegram — opcional, só ativa se o token e o
// chat_id estiverem configurados (tela de Configurações, ou TELEGRAM_BOT_TOKEN
// / TELEGRAM_CHAT_ID no .env como valor inicial).
export async function sendTelegramMessage(text) {
  const { telegramBotToken: botToken, telegramChatId: chatId } = getSettings();
  if (!botToken || !chatId) return;

  const result = await sendTelegramMessageWith(botToken, chatId, text);
  if (!result.ok) {
    console.error('[telegram] falha ao enviar alerta:', result.error);
  }
}
