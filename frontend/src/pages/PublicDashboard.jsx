import { useCallback, useEffect, useState } from 'react';
import { getColors } from '../theme/colors.js';
import { api } from '../api/client.js';
import PublicHeader from '../components/PublicHeader.jsx';
import LoginModal from '../components/LoginModal.jsx';
import HeroBanner, { buildHeroBanner } from '../components/HeroBanner.jsx';
import IndicatorCards from '../components/IndicatorCards.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import { ICONS, TYPE_META } from '../components/Icon.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

const THEME_KEY = 'ip_dashboard_theme';
const POLL_MS = 15000;

function reveal(index) {
  return { animation: 'fadeInUp .5s ease both', animationDelay: `${index * 0.06}s` };
}

function buildPublicCards(colors, payload) {
  const cards = [];
  if (payload.summary) {
    const s = payload.summary;
    cards.push({ title: 'Dispositivos monitorados', value: String(s.total), stateColor: colors.gray, stateText: 'Total cadastrado', iconBg: colors.graySoft, iconColor: colors.gray, iconPaths: ICONS.network, plain: 'Quantidade de equipamentos cadastrados na rede.' });
    cards.push({ title: 'Online', value: String(s.online), stateColor: colors.green, stateText: 'Respondendo normalmente', iconBg: colors.greenSoft, iconColor: colors.green, iconPaths: ICONS.check, plain: 'Equipamentos respondendo agora.' });
    cards.push({ title: 'Offline', value: String(s.offline), stateColor: colors.red, stateText: 'Sem conexão', iconBg: colors.redSoft, iconColor: colors.red, iconPaths: ICONS.offline, plain: 'Equipamentos sem resposta de ping agora.' });
    cards.push({ title: 'Degradados', value: String(s.degraded), stateColor: colors.amber, stateText: 'Ping ok, serviço fora', iconBg: colors.amberSoft, iconColor: colors.amber, iconPaths: ICONS.warningTriangle, plain: 'Respondem ping mas o serviço configurado não responde.' });
  }
  if (payload.alerts) {
    const activeCount = payload.alerts.filter((a) => a.status === 'active').length;
    cards.push({ title: 'Alertas ativos', value: String(activeCount), stateColor: activeCount > 0 ? colors.amber : colors.green, stateText: activeCount > 0 ? 'Requer atenção' : 'Tudo certo', iconBg: activeCount > 0 ? colors.amberSoft : colors.greenSoft, iconColor: activeCount > 0 ? colors.amber : colors.green, iconPaths: ICONS.warningTriangle, plain: 'Avisos que precisam de atenção.' });
  }
  return cards;
}

function TypeBreakdownPanel({ colors, breakdown }) {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;
  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 12 }}>Por tipo de equipamento</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {entries.map(([type, s]) => (
          <div key={type} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>{TYPE_META[type]?.label || type}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 12, color: colors.textSecondary }}>
              <span style={{ color: colors.green, fontWeight: 700 }}>{s.online || 0} online</span>
              {s.offline > 0 && <span style={{ color: colors.red, fontWeight: 700 }}>{s.offline} offline</span>}
              {s.degraded > 0 && <span style={{ color: colors.amber, fontWeight: 700 }}>{s.degraded} degradado</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicDashboard({ onLogin, settings }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [payload, setPayload] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const colors = getColors(theme);
  const isDark = theme === 'dark';

  const load = useCallback(async () => {
    try {
      const data = await api.publicDashboard();
      setPayload(data);
      setLastUpdate(new Date());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setTimeout(() => setRefreshing(false), 400); }
  }, [load]);

  async function handleLogin(username, password) {
    await onLogin(username, password);
    setShowLogin(false);
  }

  if (loadError && !payload) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontFamily: "'Manrope',sans-serif", flexDirection: 'column', gap: 12 }}>
        <div>Não foi possível carregar o painel público.</div>
        <button onClick={() => setShowLogin(true)} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Entrar</button>
        {showLogin && <LoginModal colors={colors} onLogin={handleLogin} onClose={() => setShowLogin(false)} logoUrl={settings.logoUrl} />}
      </div>
    );
  }

  if (!payload) {
    return <LoadingScreen colors={colors} label="Carregando painel..." />;
  }

  const cards = buildPublicCards(colors, payload);
  const heroBanner = payload.heroBanner ? buildHeroBanner(colors, payload.heroBanner) : null;

  return (
    <div style={{ background: colors.pageGradient, minHeight: '100vh', transition: 'background .2s ease' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Manrope',sans-serif" }}>

        <PublicHeader
          colors={colors}
          companyName={settings.companyName}
          siteName={settings.siteName}
          logoUrl={settings.logoUrl}
          status={payload.status}
          lastUpdateLabel={lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          isDark={isDark}
          onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
          onLoginClick={() => setShowLogin(true)}
        />

        {heroBanner && <HeroBanner colors={colors} banner={heroBanner} />}

        {cards.length > 0 && <IndicatorCards colors={colors} cards={cards} />}

        {payload.typeBreakdown && (
          <div style={reveal(1)}>
            <TypeBreakdownPanel colors={colors} breakdown={payload.typeBreakdown} />
          </div>
        )}

        {payload.alerts && (
          <div style={reveal(2)}>
            <AlertsPanel colors={colors} alerts={payload.alerts} />
          </div>
        )}

      </div>

      {showLogin && <LoginModal colors={colors} onLogin={handleLogin} onClose={() => setShowLogin(false)} logoUrl={settings.logoUrl} />}
    </div>
  );
}
