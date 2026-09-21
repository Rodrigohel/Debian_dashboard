#!/usr/bin/env bash
# Build especial do frontend para rodar embutido dentro de outro sistema
# ("Portal", via iframe, mesma origem/domínio) — NÃO é o build normal usado
# pelo install.sh/update.sh (frontend/dist) nem afeta o modo standalone.
#
# Diferenças desse build:
#   - VITE_BASE_PATH: caminho onde o Portal serve os assets (padrão: /apps/rede/)
#   - VITE_API_URL=/gateway/rede: chamadas de API vão pro proxy autenticado
#     do Portal em vez da própria origem
#   - VITE_EMBEDDED=true: reusa o token de sessão do Portal (mesmo
#     localStorage, mesma origem) em vez de pedir login de novo
#
# Saída em frontend/dist-embed — frontend/dist (o build normal) não é tocado.
#
# Uso (dentro da pasta do painel, ex.: /opt/ip-dashboard):
#   ./build-embed.sh
#   BASE_PATH=/outro/caminho/ ./build-embed.sh
set -euo pipefail

c_reset='\033[0m'; c_bold='\033[1m'; c_blue='\033[1;34m'; c_green='\033[1;32m'
log()  { echo -e "\n${c_blue}==>${c_reset} ${c_bold}$1${c_reset}"; }
info() { echo -e "    $1"; }
die()  { echo -e "\033[1;31m[erro]\033[0m $1" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$SCRIPT_DIR/frontend" ] || \
  die "Rode este script de dentro da pasta do painel (onde está frontend/)."

BASE_PATH="${BASE_PATH:-/apps/rede/}"

log "1/2 — Dependências do frontend"
cd "$SCRIPT_DIR/frontend"
npm install --no-audit --no-fund --silent

log "2/2 — Build para embutir no Portal (base: $BASE_PATH)"
VITE_BASE_PATH="$BASE_PATH" VITE_API_URL=/gateway/rede VITE_EMBEDDED=true \
  npx vite build --outDir dist-embed

echo
echo -e "${c_green}Build concluído.${c_reset}"
info "Saída: $SCRIPT_DIR/frontend/dist-embed"
info "O build normal (frontend/dist, usado pelo painel standalone) não foi alterado."
