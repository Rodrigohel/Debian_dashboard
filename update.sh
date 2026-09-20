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

log "1/4 — Baixando a versão mais nova"
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

log "2/4 — Backend: dependências"
cd "$SCRIPT_DIR/backend"
npm install --omit=dev --no-audit --no-fund --silent
# Upgrades vindos de antes do recurso de credenciais de dispositivo não têm
# essa chave — adiciona automaticamente pra não deixar a criptografia sem
# chave (o que faria a leitura de senha salva falhar silenciosamente).
if ! grep -q '^CREDENTIALS_KEY=' .env; then
  echo "CREDENTIALS_KEY=$(openssl rand -hex 32)" >> .env
  info "CREDENTIALS_KEY adicionada ao .env existente (necessária para as credenciais de dispositivo)."
fi

log "3/4 — Frontend: dependências e build"
cd "$SCRIPT_DIR/frontend"
npm install --no-audit --no-fund --silent
npm run build --silent

chown -R "$SERVICE_USER:$SERVICE_USER" "$SCRIPT_DIR"
[ -d "$SCRIPT_DIR/.git" ] && chown -R root:root "$SCRIPT_DIR/.git"

log "4/4 — Reiniciando o serviço"
systemctl restart "$SERVICE_NAME"
sleep 2
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  die "O serviço não subiu depois da atualização — veja os logs com: journalctl -u $SERVICE_NAME -n 50"
fi

echo
echo -e "${c_green}Atualização concluída.${c_reset} Serviço '$SERVICE_NAME' rodando normalmente."
echo "  journalctl -u $SERVICE_NAME -f   # acompanhar logs, se quiser conferir"
