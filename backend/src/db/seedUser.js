import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { db } from './sqlite.js';

/**
 * Cria (ou atualiza a senha de) um usuário do painel.
 * Uso interativo: node src/db/seedUser.js
 * Uso não-interativo: node src/db/seedUser.js <usuario> <nomeExibicao> <senha>
 * Uso não-interativo sem expor a senha via argv/histórico do shell:
 *   echo "minhaSenha" | node src/db/seedUser.js <usuario> <nomeExibicao> --password-stdin
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')));
    process.stdin.on('error', reject);
  });
}

function promptLines(questions) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answers = [];
    let i = 0;
    rl.setPrompt('');
    rl.question(`${questions[i]}: `, function onAnswer(answer) {
      answers.push(answer.trim());
      i += 1;
      if (i < questions.length) {
        rl.question(`${questions[i]}: `, onAnswer);
      } else {
        rl.close();
        resolve(answers);
      }
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  let username, displayName, password;

  if (argv.length >= 3 && argv[2] === '--password-stdin') {
    [username, displayName] = argv;
    password = await readStdin();
  } else if (argv.length >= 3) {
    [username, displayName, password] = argv;
  } else if (argv.length === 0) {
    [username, displayName, password] = await promptLines([
      'Usuário (login)',
      'Nome de exibição (ex.: Renata M.)',
      'Senha',
    ]);
  }

  if (!username || !password) {
    console.error('Usuário e senha são obrigatórios.');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, display_name = ? WHERE username = ?').run(hash, displayName || username, username);
    console.log(`Senha atualizada para o usuário "${username}".`);
  } else {
    db.prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)').run(username, displayName || username, hash);
    console.log(`Usuário "${username}" criado.`);
  }
  process.exit(0);
}

main();
