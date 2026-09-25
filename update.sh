#!/usr/bin/env bash
# Atualização rápida do Dashboard de Monitoramento de Rede — para quando o
# painel já está instalado e só precisa pegar uma versão nova do código.
#
# Diferente do install.sh (que reconfigura tudo do zero: dependências de
# sistema, usuário, systemd), este script só faz o necessário pra uma
# atualização: git pull, reinstalar dependências do Node se mudaram,
# rebuildar o frontend e reiniciar o serviço. Não pede nada, não mexe na
# senha do admin nem nos dispositivos já cadastrados.
#
# Uso (dentro da pasta onde o painel já está instalado, ex.: /opt/ip-dashboard):
#   sudo ./update.sh
set -euo pipefail

c_reset='\033[0m'; c_bold='\033[1m'; c_blue='\033[1;34m'; c_yellow='\033[1;33m'; c_red='\033[1;31m'; c_green='\033[1;32m'
log()  { echo -e "\n${c_blue}==>${c_reset} ${c_bold}$1${c_reset}"; }
info() { echo -e "    $1"; }
warn() { echo -e "${c_yellow}[aviso]${c_reset} $1"; }
die()  { echo -e "${c_red}[erro]${c_reset} $1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode como root: sudo ./update.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$SCRIPT_DIR/backend" ] && [ -d "$SCRIPT_DIR/frontend" ] || \
  die "Rode este script de dentro da pasta do painel (onde estão backend/ e frontend/)."
[ -f "$SCRIPT_DIR/backend/.env" ] || \
  die "backend/.env não existe — parece que o painel ainda não foi instalado. Rode ./install.sh primeiro."

cd "$SCRIPT_DIR"

SERVICE_USER="${SERVICE_USER:-ip-dashboard}"
SERVICE_NAME="${SERVICE_NAME:-ip-dashboard-backend}"

git config --global --add safe.directory "$SCRIPT_DIR" 2>/dev/null || true

log "1/5 — Baixando a versão mais nova"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BEFORE="$(git rev-parse HEAD)"
git fetch origin "$BRANCH" --quiet
# --ff-only: nunca cria merge commit nem sobrescreve nada — se não der pra
# avançar de forma direta (ex.: alguém editou algo manualmente no servidor),
# para e avisa em vez de arriscar perder essa mudança.
git pull --ff-only origin "$BRANCH" --quiet || die "git pull falhou — o branch local pode ter mudanças próprias. Resolva manualmente (git status) e rode de novo."
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  info "Já estava na versão mais recente ($BRANCH @ ${AFTER:0:7})."
else
  info "Atualizado de ${BEFORE:0:7} para ${AFTER:0:7}."
fi

log "2/5 — Backend: dependências"
cd "$SCRIPT_DIR/backend"
npm install --omit=dev --no-audit --no-fund --silent
# Upgrades vindos de antes do recurso de credenciais de dispositivo não têm
# essa chave — adiciona automaticamente pra não deixar a criptografia sem
# chave (o que faria a leitura de senha salva falhar silenciosamente).
if ! grep -q '^CREDENTIALS_KEY=' .env; then
  echo "CREDENTIALS_KEY=$(openssl rand -hex 32)" >> .env
  info "CREDENTIALS_KEY adicionada ao .env existente (necessária para as credenciais de dispositivo)."
fi

log "3/5 — Frontend: dependências e build"
cd "$SCRIPT_DIR/frontend"
npm install --no-audit --no-fund --silent
npm run build --silent

chown -R "$SERVICE_USER:$SERVICE_USER" "$SCRIPT_DIR"
[ -d "$SCRIPT_DIR/.git" ] && chown -R root:root "$SCRIPT_DIR/.git"

log "4/5 — Reiniciando o serviço"
systemctl restart "$SERVICE_NAME"
sleep 2
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  die "O serviço não subiu depois da atualização — veja os logs com: journalctl -u $SERVICE_NAME -n 50"
fi

# Checa o painel de fora do localhost — um `curl localhost` sozinho não
# pega bugs que só se manifestam pra quem acessa por IP de verdade sem
# HTTPS (ex.: um CSP mal configurado que já derrubou o acesso por LAN uma
# vez, mesmo com o processo respondendo perfeitamente em 127.0.0.1).
PORT="$(grep -oP '^PORT=\K.*' "$SCRIPT_DIR/backend/.env" 2>/dev/null || true)"
PORT="${PORT:-3002}"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
LAN_IP="${LAN_IP:-127.0.0.1}"

health_check_ok() {
  local base="http://${LAN_IP}:${PORT}"
  local status
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$base/health" 2>/dev/null || echo 000)"
  if [ "$status" != "200" ]; then
    warn "Painel não respondeu em $base/health (status: $status)."
    return 1
  fi

  # upgrade-insecure-requests no CSP faz o navegador tentar buscar os
  # arquivos do painel via HTTPS mesmo acessando por HTTP puro — como esta
  # porta não fala TLS, a página fica em branco pra quem acessa de fora do
  # localhost (já aconteceu uma vez). curl não executa CSP, então checamos
  # o header na mão.
  if curl -sI --max-time 5 "$base/health" 2>/dev/null | grep -qi 'upgrade-insecure-requests'; then
    warn "CSP com 'upgrade-insecure-requests' — isso quebra o acesso por HTTP puro (sem certificado)."
    return 1
  fi

  return 0
}

log "5/5 — Verificando se o painel responde de verdade (não só localhost)"
if health_check_ok; then
  info "Painel respondendo normalmente em http://$LAN_IP:$PORT"
else
  if [ "$BEFORE" = "$AFTER" ]; then
    die "Verificação falhou e não há versão anterior pra reverter (já estava nessa versão antes). Veja: journalctl -u $SERVICE_NAME -n 80"
  fi

  warn "Verificação falhou — revertendo automaticamente para a versão anterior (${BEFORE:0:7})..."
  git reset --hard "$BEFORE" --quiet
  cd "$SCRIPT_DIR/backend" && npm install --omit=dev --no-audit --no-fund --silent
  cd "$SCRIPT_DIR/frontend" && npm install --no-audit --no-fund --silent && npm run build --silent
  chown -R "$SERVICE_USER:$SERVICE_USER" "$SCRIPT_DIR"
  [ -d "$SCRIPT_DIR/.git" ] && chown -R root:root "$SCRIPT_DIR/.git"
  systemctl restart "$SERVICE_NAME"
  sleep 2

  if health_check_ok; then
    die "Atualização para ${AFTER:0:7} revertida automaticamente — o painel voltou pra versão anterior (${BEFORE:0:7}) e está funcionando. NÃO rode ./update.sh de novo até o problema em ${AFTER:0:7} ser corrigido (ele será baixado de novo e vai falhar do mesmo jeito)."
  else
    die "Reversão automática tentada, mas o painel AINDA não responde corretamente. Algo mais grave está acontecendo — verifique manualmente: systemctl status $SERVICE_NAME / journalctl -u $SERVICE_NAME -n 80"
  fi
fi

echo
echo -e "${c_green}Atualização concluída.${c_reset} Serviço '$SERVICE_NAME' rodando normalmente."
echo "  journalctl -u $SERVICE_NAME -f   # acompanhar logs, se quiser conferir"
