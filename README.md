# Dashboard de Monitoramento de Rede

Painel de monitoramento em tempo real para os equipamentos de rede fixos
(NVRs, câmeras, porteiros, interfones, switches, APs etc.): mostra o status
de cada IP (online / offline / degradado), sinaliza na hora quando um
equipamento fica sem conexão, **descobre automaticamente MAC, fabricante e
modelo** de cada dispositivo, e manda alerta (e opcionalmente Telegram)
quando algo cai.

Construído nos mesmos moldes do painel de PBX/Asterisk já usado
([FreePBX_Asterisk](https://github.com/Rodrigohel/FreePBX_Asterisk)): mesma
stack (Node/Express + WebSocket + SQLite no backend, React/Vite no
frontend), mesma paleta visual, mesmo esquema de autenticação (JWT) e painel
público opcional.

- **`backend/`** — API REST + WebSocket em Node.js/Express. Verifica cada IP
  cadastrado por **ping (ICMP)** e, opcionalmente, por **checagem de porta
  TCP**, a cada poucos segundos. Descobre **MAC** (tabela ARP do kernel),
  **fabricante** (base oficial IEEE OUI) e, best-effort, **marca/modelo**
  (ONVIF/WS-Discovery, SSDP/UPnP, fingerprint da interface web). Guarda
  status, histórico de latência e eventos de queda/recuperação em SQLite,
  com autenticação por usuário/senha (JWT).
- **`frontend/`** — aplicação React (Vite) com o painel de dispositivos,
  filtros por tipo/status, busca, alertas, varredura de rede e importação em
  massa via CSV. **O próprio backend serve este frontend já buildado** — um
  processo só, uma porta só, sem precisar de Nginx/Apache.
- **`install.sh`** — instalador automatizado de ponta a ponta.

## Recursos do painel

- **Dispositivos**: tabela com colunas clicáveis para ordenar (status, nome,
  IP, MAC, tipo, fabricante, local, latência, última checagem), filtro por
  status/tipo/fabricante e busca livre (nome, IP, MAC, local).
- **Exportação**: CSV (para editar em planilha) e **PDF** (relatório pronto
  para imprimir ou anexar, agrupado por tipo e fabricante) — botões "CSV" e
  "PDF" na tela de Dispositivos.
- **Histórico de queda/recuperação**: aba "Histórico" — cada evento mostra
  quando caiu, quando voltou e **quanto tempo durou** o estado anterior,
  filtrável por tipo de evento, período e dispositivo.
- **Análise de rede**: gráfico "Saúde da rede ao longo do tempo" (online /
  degradado / offline empilhados, 6h a 30 dias) com latência média do
  período e tooltip ao passar o mouse.
- **Latência da rede**: gráfico dedicado com a **mediana** da latência de
  todos os dispositivos e uma faixa até o **p95** (mostra os picos sem deixar
  1 equipamento ruim isolado distorcer a leitura), mesmo seletor de período e
  tooltip com mediana/p95/máxima/média no ponto.
- **Destaques**: dois rankings automáticos logo abaixo dos gráficos —
  **"Mais instáveis (24h)"** (quem mais caiu) e **"Maior latência agora"** —
  pra ir direto no equipamento problemático em vez de vasculhar ~230 IPs.
- **"X dias sem incidente crítico"**: contador animado no topo do painel
  (estilo placa de operação), com o tempo desde a última vez que algum
  dispositivo ficou offline — fica amarelo se um incidente aconteceu nas
  últimas 24h.
- **Relatório executivo em PDF**: um resumo de uma página (uptime médio,
  incidentes no período, tempo total offline, latência, situação por tipo e
  top 5 mais instáveis) pra imprimir ou anexar num e-mail de status — botão
  "Relatório executivo" na aba "Análise de rede", com período de 7 ou 30
  dias. Diferente do "Exportar PDF" da lista de dispositivos, que é a ficha
  técnica completa de cada equipamento.
- **Mapa de calor de disponibilidade**: no detalhe de cada dispositivo, um
  calendário estilo "GitHub contributions" com os últimos 30 ou 90 dias —
  cada quadradinho é um dia, colorido por % de uptime (verde a vermelho), com
  tooltip mostrando a data exata. Mostra padrões que um número sozinho
  esconde (ex.: incidentes recorrentes, uma queda isolada de semanas atrás
  que ainda pesa na média).
- **Planta baixa interativa, com vários pavimentos**: pensada pra prédio de
  verdade — cadastre quantos pavimentos precisar (subsolo, térreo, garagem 1,
  garagem 2, 1º andar, 2º andar...), cada um com sua própria imagem, e
  posicione os dispositivos de cada andar arrastando o pino sobre a planta.
  O seletor de pavimentos é estilo painel de elevador: cada andar mostra um
  pontinho colorido ao vivo (verde/amarelo/vermelho, o pior status entre os
  dispositivos daquele andar) e a contagem de dispositivos — dá pra ver de
  longe qual andar tem problema antes de abrir. Reordene os andares com as
  setinhas (ex.: de cima pra baixo, na ordem física do prédio), renomeie,
  troque a imagem ou exclua um pavimento a qualquer momento — os dispositivos
  continuam monitorados normalmente, só saem da planta. O pino também muda
  de cor com o status ao vivo e mostra um ícone de chave de fenda se o
  dispositivo estiver em manutenção; clicar nele abre o detalhe. Só admin
  cria/edita pavimentos e arrasta pinos; qualquer usuário logado pode ver.
- **Manutenção programada**: marque um dispositivo em manutenção por 30min,
  1h, 4h ou 24h — o monitoramento e o histórico continuam normais, só o
  alerta (e o Telegram) fica em silêncio, pra não gerar ruído enquanto
  alguém mexe fisicamente no equipamento.
- **Saúde por local**: painel agrupando os dispositivos por localização
  (bloco, portaria, garagem...) em vez de só por tipo — direto ao ponto
  quando o problema é elétrico/de rede de um setor inteiro.
- **QR code por dispositivo**: no detalhe, um QR code que abre direto aquele
  dispositivo no celular (via link com `#device/ID`) — cola uma etiqueta
  física perto do equipamento e o técnico de campo escaneia na hora.
- **Notificações desktop**: som + notificação do navegador quando um
  dispositivo fica offline, mesmo com a aba minimizada — toggle (sino) no
  topo do painel.
- **Modo TV/parede**: tela cheia alternando sozinho entre os painéis
  principais a cada 15s — ícone de TV ao lado do sino, pensado pra um
  monitor fixo numa sala de operação.
- **Relatório executivo automático**: manda o mesmo PDF do botão "Relatório
  executivo" sozinho pelo Telegram já configurado, semanal ou mensalmente
  (Configurações → Telegram).
- **Saúde do servidor**: CPU, memória, disco e uptime da própria máquina que
  roda o painel (aba "Servidor").
- **Usuários**: crie/remova outros logins pela tela de Configurações → aba
  "Usuários", cada um como Administrador (acesso total) ou Usuário comum
  (vê o painel, mas não a tela de Configurações).
- **Configurações**: tudo num só lugar — identidade (nome/logo), intervalo
  e timeout do ping, limiar de falhas para marcar offline, prefixo de rede
  do "Escanear rede", retenção do histórico, lembrete de alerta e Telegram.
- **Acesso do equipamento**: guarde usuário/senha da interface web de cada
  câmera/NVR/porteiro no próprio cadastro (aba de detalhe do dispositivo) —
  senha **criptografada em repouso** (AES-256-GCM), nunca aparece em CSV/PDF
  nem na listagem, e só é descriptografada na tela de detalhe de UM
  dispositivo por vez. Tem botão de copiar, mostrar/ocultar e um atalho
  "Abrir interface web" que já abre o IP do equipamento em nova aba.
- **Favoritos**: marque os dispositivos mais importantes com a estrela (na
  tabela ou no detalhe) e filtre só por eles — útil com ~230 IPs na lista.
- **Uptime por dispositivo**: cada detalhe mostra o **% de tempo no ar nos
  últimos 7 dias**, calculado a partir do histórico real de queda/
  recuperação.
- **Busca rápida (Ctrl/Cmd+K)**: paleta de comando para pular direto para
  qualquer dispositivo por nome, IP, MAC, fabricante ou local, sem precisar
  rolar a tabela.
- **Notificações no próprio painel**: ações como escanear, identificar,
  exportar ou importar mostram um aviso discreto (toast) no canto da tela,
  em vez de um alerta bloqueante do navegador.
- **Backup automático do banco**: cópia comprimida (`.db.gz`) gerada 1x por
  dia sozinha, com rotação automática (mantém só os últimos N dias,
  configurável) — Configurações → aba "Backup". Também dá pra gerar um
  backup na hora, baixar qualquer um deles, ou **restaurar** (a partir de um
  backup já salvo no servidor ou de um arquivo enviado pelo navegador): o
  painel reinicia sozinho pra aplicar a troca com segurança, e guarda uma
  cópia do banco anterior antes de sobrescrever, caso o backup escolhido
  seja o errado.
- **Log de auditoria**: histórico de quem fez o quê — login (inclusive
  tentativas falhas), criar/editar/remover dispositivo ou pavimento,
  criar/remover usuário, alterar configurações e backup/restore.
  Configurações → aba "Segurança".
- **Bloqueio de login por tentativas**: depois de várias senhas erradas
  seguidas (padrão: 5, numa janela de 15min), a origem fica temporariamente
  bloqueada (padrão: 15min) — limites configuráveis em Configurações → aba
  "Segurança".

## Instalação — um único comando

```bash
git clone -b claude/network-ip-monitoring-dashboard-mjksqv https://github.com/rodrigohel/debian_dashboard.git /opt/ip-dashboard
cd /opt/ip-dashboard
sudo ./install.sh
```

O script faz tudo sozinho: instala Node.js 20 e `iputils-ping`, copia o
projeto para `/opt/ip-dashboard` (se você rodou de outro lugar), cria um
usuário de sistema dedicado, instala as dependências, gera o `.env` do
backend com um segredo aleatório, cria o primeiro usuário admin, builda o
frontend e registra tudo como serviço systemd (`ip-dashboard-backend`),
já habilitado para iniciar sozinho no boot. No fim ele imprime o endereço
para acessar e, se você não informou usuário/senha, o login gerado
automaticamente (**anote na hora**, só aparece uma vez).

É **idempotente**: rodar `sudo ./install.sh` de novo atualiza tudo sem
apagar dispositivos cadastrados nem resetar a senha do admin — mas ele
sempre refaz a parte de instalação completa (checagem do Node, usuário de
sistema, unidade systemd), o que é mais lento e verboso do que precisa ser
só para pegar uma atualização.

### Atualizando depois do primeiro install

Para isso existe o `update.sh` — mais rápido, só faz o que uma atualização
de verdade precisa (baixar o código novo, reinstalar dependências que
mudaram, rebuildar o frontend, reiniciar o serviço):

```bash
cd /opt/ip-dashboard
sudo ./update.sh
```

Ele já vem no repositório, então funciona a partir do primeiro
`git clone` — não precisa rodar `install.sh` de novo nem depois de um
`update.sh`, um substitui o outro para esse fim. Só volte a usar
`install.sh` se precisar reconfigurar algo do sistema (trocar a porta,
reinstalar o serviço systemd, etc.).

Tudo pode ser pré-definido por variável de ambiente para instalação 100%
não-interativa (útil em automação):

```bash
sudo NETWORK_BASE=192.168.1 COMPANY_NAME="Meu Condomínio" \
     ADMIN_USER=admin ADMIN_PASSWORD='troque-esta-senha' \
     BACKEND_PORT=3002 ./install.sh
```

Depois de instalado, acesse `http://IP-DO-SERVIDOR:3002` (na rede local ou
pelo IP do Tailscale — ver seção abaixo).

> Prefere instalar manualmente passo a passo, ou entender o que o script faz
> por dentro? Veja "Instalação manual" no fim deste README.

### Acesso remoto (Tailscale)

Como a máquina já tem o Tailscale configurado, **não é preciso nenhuma
configuração extra de rede** para acessar o painel de fora: o backend escuta
em `0.0.0.0` de propósito, então basta acessar pelo IP Tailscale da máquina
(`tailscale ip -4`) na mesma porta, exatamente como já é feito para o painel
do PBX. Se tiver firewall (`ufw`) ativo, libere a porta só na interface do
Tailscale, nunca na da internet:

```bash
sudo ufw allow in on tailscale0 to any port 3002
```

## Login é obrigatório?

Só para ver e editar a lista completa de dispositivos. A página abre num
**painel público** (você escolhe quais cards aparecem ali — ver "Painel
público" abaixo); para ver a lista com IP/nome de cada equipamento,
adicionar/remover dispositivos, escanear a rede ou configurar alertas, é
preciso logar clicando em "Entrar".

## MAC, fabricante e modelo — como funciona

Não existe API universal que devolva "marca e modelo" de qualquer
equipamento de rede — o painel combina várias fontes, cada uma cobrindo uma
fatia diferente dos ~230 dispositivos, tudo automático:

- **MAC**: lido direto da tabela ARP do kernel (`/proc/net/arp`), populada
  de graça pelo próprio ping — nenhuma consulta extra é feita. Preenchido
  sozinho a cada rodada de monitoramento, para todo dispositivo online.
- **Fabricante**: derivado do MAC pela base oficial **IEEE OUI** (pacote
  `oui-data`, ~54 mil fabricantes registrados, atualizado automaticamente
  via `npm install` — sem download manual). Assim que o MAC é conhecido, o
  fabricante aparece sozinho.
- **Marca/modelo** (best-effort, mais lento): botão **"Identificar agora"**
  (um dispositivo) ou **"Identificar tudo"** (todos de uma vez) combinam:
  - **ONVIF/WS-Discovery** — padrão que a maioria das câmeras IP e NVRs
    profissionais (Hikvision, Dahua, Intelbras, Axis...) usa para se
    anunciar na rede; costuma trazer o modelo exato.
  - **SSDP/UPnP** — usado por roteadores, NVRs e outros equipamentos de
    rede/consumo; a resposta aponta para um XML com fabricante/modelo.
  - **Fingerprint HTTP** — título da página e cabeçalho `Server` da
    interface web do equipamento, quando as duas fontes acima não
    respondem.
- O botão **"Escanear rede"** já roda a identificação automaticamente em
  todo dispositivo novo que encontrar — não precisa de um segundo clique.
- Nenhuma dessas fontes exige senha/credencial do equipamento, e nenhuma é
  garantida — cada modelo real responde a um subconjunto diferente delas.
  MAC e fabricante, os dois campos mais confiáveis, também podem ser
  editados manualmente no detalhe do dispositivo se precisar corrigir algo
  (comum em produtos com marca própria montados sobre hardware OEM, ex.:
  vários equipamentos vendidos como "Intelbras" usam chipset/MAC de
  fabricantes chineses parceiros).

## Cadastrando os ~230 dispositivos

Três formas de popular a lista, pode combinar as três:

1. **Varredura de rede** (mais rápido para começar): na tela de
   Dispositivos, clique em **"Escanear rede"** — o backend faz um ping
   sweep no prefixo configurado em `NETWORK_BASE` (padrão `192.168.1`, de
   `.1` a `.254`), cadastra automaticamente todo IP que responder e ainda
   não estiver na lista, e já roda a identificação (MAC/fabricante/modelo)
   nesses novos. Depois é só abrir cada um e ajustar nome/tipo/local.
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
"Exportar CSV", inclui MAC/fabricante/modelo já descobertos), editar em
planilha e reimportar.

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
| Chave de criptografia das senhas de equipamento salvas | `backend/.env` → `CREDENTIALS_KEY` (gerada automaticamente pelo `install.sh`; nunca comitar/perder — trocá-la invalida as senhas já salvas) |

## Endpoints do backend

- `GET /health` — healthcheck, sem autenticação.
- `POST /api/auth/login` — autenticação (usuário/senha → JWT).
- `GET /api/public/dashboard` — painel público, sem autenticação; só os
  cards ligados em `PUBLIC_SHOW_*`.
- `GET/POST/PUT/DELETE /api/devices` — CRUD de dispositivos, protegido por
  `Authorization: Bearer <token>` (criar/editar/remover exige admin).
- `GET /api/devices/summary` — contagem online/offline/degradado, por tipo.
- `POST /api/devices/scan` — varredura de ping na rede (já identifica os
  novos automaticamente).
- `POST /api/devices/import` / `GET /api/devices/export` — CSV em massa.
- `GET /api/devices/export/pdf` — relatório em PDF de todos os dispositivos.
- `POST /api/devices/:id/check` — força uma verificação de ping imediata.
- `POST /api/devices/:id/favorite` — marca/desmarca um dispositivo como
  favorito.
- `GET /api/devices/:id/uptime-heatmap?days=90` — % de uptime por dia de
  calendário, para o mapa de calor de disponibilidade.
- `POST /api/devices/:id/maintenance` — coloca/tira um dispositivo de
  manutenção (`until: ISOString | null`).
- `POST /api/devices/:id/floor-position` — posição (`floorId` + x/y, 0 a 1)
  de um dispositivo num pavimento; todos `null` remove de qualquer planta.
- `GET /api/floors` — lista os pavimentos cadastrados (nome, imagem, ordem).
- `POST /api/floors` — cria um pavimento (nome + imagem, admin).
- `PUT /api/floors/:id` — renomeia um pavimento (admin).
- `POST /api/floors/:id/image` — troca a imagem de um pavimento (admin).
- `DELETE /api/floors/:id` — exclui um pavimento; os dispositivos nele saem
  da planta mas continuam monitorados normalmente (admin).
- `POST /api/floors/reorder` — grava a nova ordem dos pavimentos (admin).
- `POST /api/devices/:id/identify` / `POST /api/devices/identify-all` — MAC,
  fabricante e modelo (ONVIF/SSDP/HTTP).
- `GET /api/alerts` — histórico de alertas ativos/resolvidos.
- `GET /api/history` — eventos de queda/recuperação com duração calculada
  (filtros: `deviceId`, `eventType`, `from`, `to`, `limit`).
- `GET /api/stats/network-history?hours=N` — série da rede (online/offline/
  degradado + latência média/mediana/p95/máxima) para os gráficos de análise.
- `GET /api/stats/server-health` — CPU, memória, disco e uptime do servidor.
- `GET /api/stats/flappiest?hours=24&limit=5` — ranking dos dispositivos que
  mais caíram no período.
- `GET /api/stats/incident-streak` — tempo desde o último dispositivo que
  ficou offline (contador "dias sem incidente").
- `GET /api/stats/report/executive?days=7` — relatório executivo em PDF do
  período (uptime, incidentes, latência, top instáveis).
- `GET/POST/DELETE /api/users` — gestão de usuários do painel (admin).
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

## Instalação manual (sem o install.sh)

Só necessário se quiser controlar cada passo manualmente, ou entender o que
o instalador faz por dentro.

### 1. Dependências do sistema

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs iputils-ping
node -v   # deve mostrar v20.x
ping -c1 127.0.0.1   # deve funcionar sem sudo
```

### 2. Copiar o projeto e criar o usuário de sistema

```bash
sudo mkdir -p /opt/ip-dashboard
git clone -b claude/network-ip-monitoring-dashboard-mjksqv https://github.com/rodrigohel/debian_dashboard.git /opt/ip-dashboard
sudo useradd --system --home /opt/ip-dashboard --shell /usr/sbin/nologin ip-dashboard
```

### 3. Backend

```bash
cd /opt/ip-dashboard/backend
npm install --omit=dev
cp .env.example .env
nano .env   # ajuste NETWORK_BASE, JWT_SECRET, TELEGRAM_* se quiser, etc.
npm run seed:user   # cria o primeiro usuário do painel
```

### 4. Frontend

```bash
cd /opt/ip-dashboard/frontend
npm install
npm run build   # gera frontend/dist — o backend serve isso sozinho
```

### 5. systemd

```bash
sudo cp /opt/ip-dashboard/deploy/systemd/ip-dashboard-backend.service /etc/systemd/system/
sudo sed -i "s#/opt/ip-dashboard#$(cd /opt/ip-dashboard && pwd)#g" /etc/systemd/system/ip-dashboard-backend.service
sudo chown -R ip-dashboard:ip-dashboard /opt/ip-dashboard
sudo systemctl daemon-reload
sudo systemctl enable --now ip-dashboard-backend
sudo systemctl status ip-dashboard-backend
```

Acesse `http://IP-DO-SERVIDOR:3002` — deve aparecer o painel público.

### Servir atrás de um Nginx/Apache dedicado (opcional)

O backend já serve o frontend sozinho — isso só é necessário se você quiser
expor o painel num subcaminho de um domínio que já existe (ex.:
`http://seu-dominio/ip-dashboard/`), reaproveitando um Nginx/Apache já
configurado para outra coisa (como o painel do PBX). Modelos prontos em
`deploy/nginx/ip-dashboard.conf` e `deploy/apache/ip-dashboard.conf` —
nesse caso, rebuilde o frontend com `VITE_BASE_PATH=/ip-dashboard/` e
`VITE_API_URL`/`VITE_WS_URL` apontando para esse subcaminho antes do
`npm run build` (ver comentários em `frontend/.env.example`).

### Embutir num Portal via iframe (opcional)

Além do build normal (`frontend/dist`, servido pelo próprio backend) e do
build atrás de Nginx/Apache acima, existe um terceiro modo: rodar este
painel embutido dentro de outro sistema ("Portal") via `<iframe>`, na
mesma origem/domínio, reaproveitando o login já feito no Portal em vez de
pedir senha de novo.

Use `./build-embed.sh` (raiz do repo) em vez de `npm run build` — ele gera
a saída em `frontend/dist-embed`, sem tocar em `frontend/dist`:

```bash
./build-embed.sh                          # base padrão: /apps/rede/
BASE_PATH=/outro/caminho/ ./build-embed.sh # outro caminho no Portal
```

Esse build usa duas variáveis de ambiente novas, além do
`VITE_BASE_PATH` já visto acima:

- `VITE_API_URL`: aponta as chamadas de API do painel para o proxy
  autenticado do Portal (ex.: `/gateway/rede`) em vez da própria origem.
- `VITE_EMBEDDED=true`: faz o painel reusar o token de sessão do Portal
  (lido de `localStorage.getItem('portal_token')`) em vez de exigir login
  próprio — só funciona porque o iframe está na mesma origem do Portal,
  então ambos compartilham o mesmo `localStorage`.

Um build normal (sem essas variáveis) não é afetado: o código do modo
embutido fica atrás de `import.meta.env.VITE_EMBEDDED`, então o Vite
remove esse trecho do bundle standalone.

Limitação conhecida: as atualizações em tempo real via WebSocket podem
não funcionar embutido, caso o proxy do Portal só cubra requisições HTTP
comuns — o painel continua funcionando normalmente nesse caso, só cai
para o polling periódico (a cada alguns segundos) em vez de atualizar
instantaneamente.
