import { db } from './sqlite.js';

/**
 * Desativa o 2FA de um usuário direto no banco — último recurso pra quando a
 * pessoa perde o app autenticador E os códigos de recuperação, e não existe
 * outro administrador no painel pra usar o botão "Desativar 2FA" da tela de
 * Usuários.
 *
 * Uso: node src/db/resetTotp.js <usuario>
 */
const username = process.argv[2];
if (!username) {
  console.error('Uso: node src/db/resetTotp.js <usuario>');
  process.exit(1);
}

const user = db.prepare('SELECT id, totp_enabled FROM users WHERE username = ?').get(username);
if (!user) {
  console.error(`Usuário "${username}" não encontrado.`);
  process.exit(1);
}
if (!user.totp_enabled) {
  console.log(`Usuário "${username}" já está com 2FA desativado.`);
  process.exit(0);
}

db.prepare("UPDATE users SET totp_secret = '', totp_enabled = 0, totp_recovery_codes = '[]' WHERE id = ?").run(user.id);
console.log(`2FA desativado para "${username}". A pessoa pode ativar de novo pela tela de Configurações → Segurança.`);
process.exit(0);
