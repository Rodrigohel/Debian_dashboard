#!/usr/bin/env bash
# Instalador automatizado do Dashboard de Monitoramento de Rede.
#
# Uso:
#   git clone <repo> /opt/ip-dashboard
#   cd /opt/ip-dashboard
#   sudo ./install.sh
#
# Idempotente: pode rodar de novo (ex.: depois de um `git pull`) para
# atualizar dependências e reiniciar o serviço, sem perder dados já
# cadastrados nem resetar a senha do admin.
#
# Todas as opções abaixo também podem ser passadas como variáveis de
# ambiente para instalação 100% não-interativa, ex.:
#   sudo NETWORK_BASE=10.0.0 ADMIN_PASSWORD=troque-isto ./install.sh
set -euo pipefail

# ---------------------------------------------------------------- helpers --
c_reset='\033[0m'; c_bold='\033[1m'; c_blue='\033[1;34m'; c_yellow='\033[1;33m'; c_red='\033[1;31m'; c_green='\033[1;32m'
log()  { echo -e "\n${c_blue}==>${c_reset} ${c_bold}$1${c_reset}"; }
info() { echo -e "    $1"; }
warn() { echo -e "${c_yellow}[aviso]${c_reset} $1"; }
die()  { echo -e "${c_red}[erro]${c_reset} $1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode como root: sudo ./install.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$SCRIPT_DIR/backend" ] && [ -d "$SCRIPT_DIR/frontend" ] || \
  die "Rode este script de dentro da pasta do projeto (onde estão backend/ e frontend/)."

command -v apt-get >/dev/null 2>&1 || die "Este instalador é para Debian/Ubuntu (apt-get não encontrado)."

# --------------------------------------------------------------- opções ---
INSTALL_DIR="${INSTALL_DIR:-/opt/ip-dashboard}"
SERVICE_USER="${SERVICE_USER:-ip-dashboard}"
BACKEND_PORT="${BACKEND_PORT:-3002}"
COMPANY_NAME="${COMPANY_NAME:-Minha Empresa}"
SITE_NAME="${SITE_NAME:-Monitoramento de Rede}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_NAME="${ADMIN_NAME:-Administrador}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
NETWORK_BASE="${NETWORK_BASE:-}"

INTERACTIVE=1
[ -t 0 ] || INTERACTIVE=0
[ -n "${NONINTERACTIVE:-}" ] && INTERACTIVE=0

ask() {
  local prompt="$1" default="$2" __var="$3" reply
  if [ "$INTERACTIVE" -eq 1 ]; then
    read -rp "$prompt [$default]: " reply || true
    printf -v "$__var" '%s' "${reply:-$default}"
  else
    printf -v "$__var" '%s' "$default"
  fi
}

detect_network_base() {
  local ip=""
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  [ -n "$ip" ] && echo "$ip" | cut -d. -f1-3 || echo "192.168.1"
}

primary_ip() {
  if command -v hostname >/dev/null 2>&1; then hostname -I 2>/dev/null | awk '{print $1}'; fi
}

log "Dashboard de Monitoramento de Rede — instalação"
info "Diretório de instalação: $INSTALL_DIR"

if [ -z "$NETWORK_BASE" ]; then
  DETECTED_BASE="$(detect_network_base)"
  ask "Prefixo /24 da rede a monitorar (ex.: 192.168.1)" "$DETECTED_BASE" NETWORK_BASE
fi
ask "Nome da empresa/condomínio (aparece no painel)" "$COMPANY_NAME" COMPANY_NAME
ask "Porta do backend (serve API + WebSocket + o próprio painel web)" "$BACKEND_PORT" BACKEND_PORT

# ---------------------------------------------------- 1. deps de sistema --
log "1/7 — Instalando dependências do sistema (curl, iputils-ping, Node.js 20)"
export DEBIAN_FRONTEND=noninteractive
# Não aborta se algum repositório de terceiros já configurado na máquina
# estiver fora do ar/quebrado — só precisamos que os pacotes abaixo estejam
# disponíveis em algum repositório que funcione.
apt-get update -qq || warn "Falha ao atualizar algum repositório apt (pode ser um PPA de terceiros) — continuando."
# build-essential/python3: rede de segurança para o better-sqlite3 (módulo
# nativo) compilar do zero caso não haja binário pré-compilado disponível
# para a arquitetura da máquina (comum em Raspberry Pi/ARM).
apt-get install -y -qq curl ca-certificates iputils-ping gnupg rsync openssl build-essential python3 >/dev/null

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]; then
  info "Instalando Node.js 20.x (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
info "Node $(node -v) / npm $(npm -v)"

if ! ping -c1 -W1 127.0.0.1 >/dev/null 2>&1; then
  warn "O comando 'ping' não respondeu nem para 127.0.0.1 — verifique se o pacote iputils-ping instalou corretamente."
fi

# ------------------------------------------------- 2. copiar para /opt ----
log "2/7 — Preparando $INSTALL_DIR"
if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
  rsync -a --delete \
    --exclude node_modules --exclude dist --exclude data --exclude .env --exclude .git \
    "$SCRIPT_DIR/" "$INSTALL_DIR/"
  info "Projeto copiado de $SCRIPT_DIR para $INSTALL_DIR"
else
  info "Já rodando a partir de $INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ------------------------------------------------------- 3. usuário ------
log "3/7 — Configurando usuário de sistema '$SERVICE_USER'"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
  info "Usuário '$SERVICE_USER' criado."
else
  info "Usuário '$SERVICE_USER' já existe."
fi

# ------------------------------------------------------- 4. backend ------
log "4/7 — Instalando e configurando o backend"
cd "$INSTALL_DIR/backend"
npm install --omit=dev --no-audit --no-fund --silent

FIRST_INSTALL=0
if [ ! -f .env ]; then
  FIRST_INSTALL=1
  cp .env.example .env
  JWT_SECRET="$(openssl rand -hex 32)"
  sed -i "s#^PORT=.*#PORT=$BACKEND_PORT#" .env
  sed -i "s#^NETWORK_BASE=.*#NETWORK_BASE=$NETWORK_BASE#" .env
  sed -i "s#^JWT_SECRET=.*#JWT_SECRET=$JWT_SECRET#" .env
  sed -i "s#^DEFAULT_COMPANY_NAME=.*#DEFAULT_COMPANY_NAME=$COMPANY_NAME#" .env
  sed -i "s#^DEFAULT_SITE_NAME=.*#DEFAULT_SITE_NAME=$SITE_NAME#" .env
  # CORS só importa se algo acessar a API vindo de outra origem — o modo
  # padrão (backend servindo o próprio frontend, ver server.js) é sempre
  # same-origin, então liberar geral aqui é seguro (a API continua exigindo
  # login/JWT para tudo que não é público).
  sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=*#" .env
  info ".env criado com um JWT_SECRET novo e aleatório."
else
  info ".env já existia — mantido sem alterações (edite manualmente se quiser mudar algo)."
fi

if [ ! -f data/dashboard.db ]; then
  if [ -z "$ADMIN_PASSWORD" ]; then
    if [ "$INTERACTIVE" -eq 1 ]; then
      read -rp "Usuário admin do painel [$ADMIN_USER]: " reply || true
      ADMIN_USER="${reply:-$ADMIN_USER}"
      while [ -z "$ADMIN_PASSWORD" ]; do
        read -rsp "Senha para '$ADMIN_USER': " ADMIN_PASSWORD; echo
      done
    else
      ADMIN_PASSWORD="$(openssl rand -base64 15)"
      GENERATED_PASSWORD=1
    fi
  fi
  node src/db/seedUser.js "$ADMIN_USER" "$ADMIN_NAME" "$ADMIN_PASSWORD" >/dev/null
  info "Usuário '$ADMIN_USER' criado."
else
  info "Já existe um usuário cadastrado — pulando criação (rode 'npm run seed:user' manualmente para adicionar outro ou trocar senha)."
fi

# ------------------------------------------------------ 5. frontend ------
log "5/7 — Instalando e buildando o frontend"
cd "$INSTALL_DIR/frontend"
npm install --no-audit --no-fund --silent
[ -f .env ] || cp .env.example .env
npm run build --silent
info "Build gerado em frontend/dist — o backend serve esses arquivos direto, sem precisar de Nginx/Apache."

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ------------------------------------------------------- 6. systemd ------
log "6/7 — Registrando o serviço systemd"
UNIT_FILE=/etc/systemd/system/ip-dashboard-backend.service
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=Dashboard de monitoramento de IPs - backend
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$(command -v node) src/server.js
EnvironmentFile=$INSTALL_DIR/backend/.env
Restart=on-failure
User=$SERVICE_USER

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ip-dashboard-backend >/dev/null 2>&1
if systemctl is-active --quiet ip-dashboard-backend; then
  systemctl restart ip-dashboard-backend
  info "Serviço reiniciado (atualização)."
else
  systemctl start ip-dashboard-backend
  info "Serviço iniciado."
fi

sleep 2
if ! systemctl is-active --quiet ip-dashboard-backend; then
  die "O serviço não subiu — veja os logs com: journalctl -u ip-dashboard-backend -n 50"
fi

# --------------------------------------------------------- 7. resumo -----
log "7/7 — Pronto!"
IP="$(primary_ip)"
echo
echo -e "${c_green}Instalação concluída.${c_reset}"
echo
echo "  Acesse o painel em:"
echo "    http://${IP:-<ip-do-servidor>}:${BACKEND_PORT}"
echo "  (mesmo endereço funciona pela rede local ou pelo IP do Tailscale — o painel escuta em 0.0.0.0)"
echo
if [ "${GENERATED_PASSWORD:-0}" -eq 1 ]; then
  echo -e "  ${c_yellow}Usuário admin gerado automaticamente:${c_reset}"
  echo "    login: $ADMIN_USER"
  echo "    senha: $ADMIN_PASSWORD"
  echo "  (anote agora — não fica salva em nenhum lugar visível depois disso)"
  echo
fi
echo "  Próximos passos sugeridos:"
echo "    - Cadastre os ~230 dispositivos: botão 'Escanear rede' no painel"
echo "      (varre ${NETWORK_BASE}.1-254 e já identifica MAC/fabricante/modelo),"
echo "      ou importe um CSV pronto (veja backend/samples/devices.sample.csv)."
echo "    - Configure notificação por Telegram na tela de Configurações, se quiser."
echo
echo "  Comandos úteis:"
echo "    journalctl -u ip-dashboard-backend -f   # acompanhar logs"
echo "    systemctl restart ip-dashboard-backend  # reiniciar"
echo "    sudo ./install.sh                       # rodar de novo após um git pull (atualiza sem perder dados)"
echo
if [ "$FIRST_INSTALL" -eq 1 ]; then
  warn "Guarde o backend/.env gerado (tem o JWT_SECRET) — não é enviado ao git."
fi
