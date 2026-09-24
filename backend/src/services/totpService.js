import crypto from 'node:crypto';

// Implementação de TOTP (RFC 6238, sobre HOTP da RFC 4226) sem dependência
// externa — compatível com Google Authenticator, Authy, etc. (HMAC-SHA1,
// passo de 30s, 6 dígitos, que é o padrão que todo app de autenticação
// espera por convenção, mesmo a RFC permitindo outras variações).
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(str) {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateSecret() {
  return base32Encode(crypto.randomBytes(20)); // 160 bits, o tamanho recomendado pela RFC 4226
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function generateToken(base32Secret, at = Date.now()) {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

// `window` = quantos passos de 30s pra cada lado aceitar, pra tolerar
// pequena diferença de relógio entre o celular e o servidor (padrão: 1 passo
// = até 30s de folga pra cada lado).
export function verifyToken(base32Secret, token, window = 1) {
  if (!/^\d{6}$/.test(String(token || ''))) return false;
  const secretBuffer = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    if (hotp(secretBuffer, counter + errorWindow) === String(token)) return true;
  }
  return false;
}

export function buildOtpauthUri({ secret, username, issuer }) {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex')); // ex.: "a1b2c3d4e5"
}
