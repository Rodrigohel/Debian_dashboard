import 'dotenv/config';

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const config = {
  port: Number(process.env.PORT || 3002),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  networkBase: process.env.NETWORK_BASE || '192.168.1',

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    sqlitePath: process.env.SQLITE_PATH || './data/dashboard.db',
  },

  // Valores iniciais de monitoramento/alertas — depois que alguém salvar
  // pela tela de Configurações, o valor no banco (settingsService) manda,
  // sem precisar reiniciar o backend.
  monitor: {
    pingIntervalSeconds: Number(process.env.PING_INTERVAL_SECONDS || 20),
    pingTimeoutMs: Number(process.env.PING_TIMEOUT_MS || 1200),
    offlineThresholdFails: Number(process.env.OFFLINE_THRESHOLD_FAILS || 2),
    pingConcurrency: Number(process.env.PING_CONCURRENCY || 25),
    checksRetentionHours: Number(process.env.CHECKS_RETENTION_HOURS || 6),
  },

  // Painel público (sem login): cada card pode ser ligado/desligado
  // independentemente. Pense com cuidado antes de ligar os marcados como
  // "dados sensíveis" — eles ficam visíveis para qualquer pessoa com o link,
  // sem autenticação.
  public: {
    enabled: bool(process.env.PUBLIC_DASHBOARD_ENABLED, true),
    cards: {
      status: bool(process.env.PUBLIC_SHOW_STATUS, true),
      heroBanner: bool(process.env.PUBLIC_SHOW_HERO_BANNER, true),
      summary: bool(process.env.PUBLIC_SHOW_SUMMARY, true),
      typeBreakdown: bool(process.env.PUBLIC_SHOW_TYPE_BREAKDOWN, true),
      // dados sensíveis: IP e nome de cada equipamento
      devicesList: bool(process.env.PUBLIC_SHOW_DEVICES_LIST, false),
      // dados sensíveis: mensagens de alerta podem citar detalhes internos
      alerts: bool(process.env.PUBLIC_SHOW_ALERTS, false),
    },
  },
};
