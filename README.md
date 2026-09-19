# Dashboard de Monitoramento de Rede

Painel de monitoramento em tempo real para os equipamentos de rede fixos
(NVRs, câmeras, porteiros, interfones, switches, APs etc.): mostra o status
de cada IP (online / offline / degradado), sinaliza na hora quando um
equipamento fica sem conexão e manda alerta (e opcionalmente Telegram)
quando isso acontece.

Construído nos mesmos moldes do painel de PBX/Asterisk já usado
([FreePBX_Asterisk](https://github.com/Rodrigohel/FreePBX_Asterisk)): mesma
stack (Node/Express + WebSocket + SQLite no backend, React/Vite no
frontend), mesma paleta visual, mesmo esquema de autenticação (JWT) e painel
público opcional, e mesmo padrão de deploy como serviço systemd num Debian.

- **`backend/`** — API REST + WebSocket em Node.js/Express. Verifica cada IP
  cadastrado por **ping (ICMP)** e, opcionalmente, por **checagem de porta
  TCP** (ex.: porta HTTP da câmera, RTSP do NVR), a cada poucos segundos.
  Guarda status, histórico de latência e eventos de queda/recuperação em
  SQLite, com autenticação por usuário/senha (JWT).
- **`frontend/`** — aplicação React (Vite) com o painel de dispositivos,
  filtros por tipo/status, busca, alertas, varredura de rede e importação em
  massa via CSV.

## Onde isso roda

Pensado para rodar **no mesmo servidor Debian onde já roda o painel do
PBX**, como mais um serviço independente:

- o backend não precisa de root: usa o `ping` do sistema (pacote
  `iputils-ping`, que no Debian já roda sem privilégio elevado) e sockets TCP
  comuns — nenhum socket raw dentro do Node;
- roda como processo Node próprio (porta configurável, padrão `3002`,
  diferente da porta `3001` do painel do PBX);
- o frontend é build estático (`frontend/dist`) e pode ser servido pelo
  mesmo Nginx/Apache que já roda no servidor, num subcaminho separado
  (ex.: `/ip-dashboard/`), do mesmo jeito que o painel do PBX.

### Acesso remoto (Tailscale)

Como a máquina já tem o Tailscale configurado, **não é preciso nenhuma
configuração extra de rede** para acessar o painel de fora: o backend escuta
em `0.0.0.0` de propósito, então basta acessar pelo IP Tailscale da máquina
(`tailscale ip -4`) na porta do backend/frontend, exatamente como já é feito
para o painel do PBX. Se você serve o frontend pelo Nginx/Apache que já
atende o painel do PBX, o mesmo host/porta que você já usa por Tailscale
passa a servir também `/ip-dashboard/` — nenhuma regra nova de firewall ou
do Tailscale é necessária, só a configuração do site web (ver seção 6
abaixo). Se preferir acessar direto na porta do backend/dev sem proxy,
libere a porta apenas na interface Tailscale, nunca na interface da
internet:

```bash
sudo ufw allow in on tailscale0 to any port 3002
sudo ufw allow in on tailscale0 to any port 5174
```

## Login é obrigatório?

Só para ver e editar a lista completa de dispositivos. A página abre num
**painel público** (você escolhe quais cards aparecem ali — ver "Painel
público" abaixo); para ver a lista com IP/nome de cada equipamento,
adicionar/remover dispositivos, escanear a rede ou configurar alertas, é
preciso logar clicando em "Entrar". O primeiro usuário é criado com
`npm run seed:user` (não existe usuário padrão pré-cadastrado, por
segurança).

## Cadastrando os ~230 dispositivos

Três formas de popular a lista, pode combinar as três:

1. **Varredura de rede** (mais rápido para começar): na tela de
   Dispositivos, clique em **"Escanear rede"** — o backend faz um ping
   sweep no prefixo configurado em `NETWORK_BASE` (padrão `192.168.1`, de
   `.1` a `.254`) e cadastra automaticamente todo IP que responder e ainda
   não estiver na lista, como tipo "Outro". Depois é só abrir cada um e
   preencher nome/tipo/local reais.
2. **Importação em massa por CSV**: preencha uma planilha com as colunas
   `ip,name,type,location,ports,notes` (veja
   `backend/samples/devices.sample.csv` como modelo — os tipos aceitos são
   `nvr`, `camera`, `porteiro`, `interfone`, `switch`, `ap`, `servidor`,
   `outro`) e importe pelo botão **"Importar CSV"** na tela de Dispositivos,
   ou via linha de comando no servidor:
   ```bash
   cd backend && npm run import:devices caminho/para/dispositivos.csv
   ```
   Rodar de novo com o mesmo arquivo atualiza os dispositivos já cadastrados
   (identificados pelo IP) em vez de duplicar.
3. **Cadastro manual**, um por um, pelo botão **"Adicionar"**.

A qualquer momento dá para **exportar a lista atual para CSV** (botão
"Exportar CSV"), editar em planilha e reimportar.

### Portas TCP (opcional, por dispositivo)

Além do ping, cada dispositivo pode ter portas TCP configuradas (ex.: `80`
para a interface web da câmera, `554` para RTSP, `8000` para o NVR). Se
configuradas, o dispositivo só aparece como **"Online"** quando o ping E
pelo menos uma dessas portas respondem; se o ping funciona mas nenhuma porta
responde, ele aparece como **"Degradado"** (equipamento ligado na rede, mas
o serviço específico parece fora do ar). Sem portas configuradas, o status
depende só do ping.

## Personalização

| O que mudar | Onde |
|---|---|
| Nome da empresa/condomínio, nome do painel, logo | Tela de Configurações (engrenagem no menu lateral, só para quem está logado) |
| Intervalo entre verificações, timeout, quantas falhas seguidas até marcar offline, lembrete de alerta | Tela de Configurações |
| Notificação por Telegram | Tela de Configurações (Bot Token + Chat ID, com botão de teste) |
| Quais cards aparecem no painel público (sem login) | `backend/.env` → `PUBLIC_SHOW_*` (reiniciar o backend depois de mudar) |
| Prefixo de rede usado pelo "Escanear rede" | `backend/.env` → `NETWORK_BASE` |

## Instalação no Debian — passo a passo

Assume um Debian com acesso root/sudo via SSH (pode ser o mesmo servidor do
PBX, ou outro).

### 1. Instalar dependências do sistema

```bash
# Node.js 20 LTS (o repositório padrão do Debian costuma ser antigo demais)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# ping (iputils-ping) — normalmente já vem instalado no Debian, mas confirme:
sudo apt install -y iputils-ping
node -v   # deve mostrar v20.x
ping -c1 127.0.0.1   # deve funcionar sem sudo
```

### 2. Copiar o projeto para o servidor

```bash
sudo mkdir -p /opt/ip-dashboard
sudo chown $USER:$USER /opt/ip-dashboard
git clone -b claude/network-ip-monitoring-dashboard-mjksqv https://github.com/rodrigohel/debian_dashboard.git /opt/ip-dashboard
cd /opt/ip-dashboard
```

Ou, sem Git no servidor, direto da sua máquina:

```bash
rsync -avz --exclude node_modules --exclude dist --exclude data ./ usuario@ip-do-servidor:/opt/ip-dashboard/
```

### 3. Criar o usuário de sistema que vai rodar o backend

```bash
sudo useradd --system --home /opt/ip-dashboard --shell /usr/sbin/nologin ip-dashboard
sudo chown -R ip-dashboard:ip-dashboard /opt/ip-dashboard
```

### 4. Configurar e subir o backend

```bash
cd /opt/ip-dashboard/backend
npm install --omit=dev
cp .env.example .env
nano .env   # ajuste NETWORK_BASE, JWT_SECRET, TELEGRAM_* se quiser, etc.
npm run seed:user   # cria o primeiro usuário do painel
npm start            # testa manualmente — Ctrl+C depois de confirmar
```

Confirme em outro terminal: `curl http://localhost:3002/health`.

Se já tiver a planilha com os ~230 IPs pronta:
```bash
npm run import:devices /caminho/para/dispositivos.csv
```

### 5. Configurar e buildar o frontend

```bash
cd /opt/ip-dashboard/frontend
npm install
cp .env.example .env
nano .env
# VITE_API_URL=http://IP-OU-DOMINIO-DO-SERVIDOR:3002
# VITE_WS_URL=ws://IP-OU-DOMINIO-DO-SERVIDOR:3002/ws
# Se for servir num subcaminho (ex.: /ip-dashboard/), defina também:
# VITE_BASE_PATH=/ip-dashboard/
npm run build
```

Gera os arquivos estáticos em `frontend/dist`.

### 6. Deixar o backend sempre rodando (systemd)

Um modelo pronto está em `deploy/systemd/ip-dashboard-backend.service`:

```bash
sudo cp deploy/systemd/ip-dashboard-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ip-dashboard-backend
sudo systemctl status ip-dashboard-backend
```

### 7. Servir o frontend pelo servidor web já existente

Descubra qual está ativo: `systemctl is-active apache2 nginx 2>/dev/null`.

**Nginx** — copie o conteúdo de `deploy/nginx/ip-dashboard.conf` para dentro
do bloco `server { ... }` do seu site (mesmo arquivo que já serve o painel
do PBX, se for o caso), depois:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Apache** — use o modelo pronto:
```bash
sudo cp deploy/apache/ip-dashboard.conf /etc/apache2/conf-available/
sudo a2enmod proxy proxy_http proxy_wstunnel
sudo a2enconf ip-dashboard
sudo systemctl reload apache2
```

Acesse `http://IP-OU-DOMINIO/ip-dashboard/` (na rede local ou pelo IP
Tailscale da máquina) — deve aparecer o painel público com o botão
"Entrar".

> Se preferir servir na raiz do domínio (sem `/ip-dashboard/`), ajuste as
> regras para `/`, `/api/` e `/ws`, e refaça o build do frontend com
> `VITE_BASE_PATH` vazio.

## Endpoints do backend

- `GET /health` — healthcheck, sem autenticação.
- `POST /api/auth/login` — autenticação (usuário/senha → JWT).
- `GET /api/public/dashboard` — painel público, sem autenticação; só os
  cards ligados em `PUBLIC_SHOW_*`.
- `GET/POST/PUT/DELETE /api/devices` — CRUD de dispositivos, protegido por
  `Authorization: Bearer <token>` (criar/editar/remover exige admin).
- `GET /api/devices/summary` — contagem online/offline/degradado, por tipo.
- `POST /api/devices/scan` — varredura de ping na rede.
- `POST /api/devices/import` / `GET /api/devices/export` — CSV em massa.
- `POST /api/devices/:id/check` — força uma verificação imediata.
- `GET /api/alerts` — histórico de alertas ativos/resolvidos.
- `GET/PUT /api/settings`, `POST /api/settings/telegram/test` — configuração.
- WebSocket em `/ws` — push do status de todos os dispositivos a cada rodada
  de monitoramento.

## Desenvolvimento local

```bash
# backend
cd backend && npm install && cp .env.example .env && npm run seed:user && npm run dev

# frontend, em outro terminal
cd frontend && npm install && cp .env.example .env && npm run dev
```

Acesse `http://localhost:5174`. Sem `iputils-ping` instalado localmente, os
pings simplesmente falham e tudo aparece como offline — instale com
`sudo apt install iputils-ping` (Debian/Ubuntu) para testar de verdade.
