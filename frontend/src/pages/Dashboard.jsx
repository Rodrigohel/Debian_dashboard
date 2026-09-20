import { useCallback, useEffect, useRef, useState } from 'react';
import { getColors } from '../theme/colors.js';
import { api, connectLiveSocket } from '../api/client.js';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import Icon, { ICONS } from '../components/Icon.jsx';
import HeroBanner, { buildHeroBanner } from '../components/HeroBanner.jsx';
import IndicatorCards, { buildIndicatorCards } from '../components/IndicatorCards.jsx';
import DevicesPanel from '../components/DevicesPanel.jsx';
import DeviceDetailModal from '../components/DeviceDetailModal.jsx';
import AddDeviceModal from '../components/AddDeviceModal.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import NetworkHistoryChart from '../components/NetworkHistoryChart.jsx';
import LatencyChart from '../components/LatencyChart.jsx';
import TopIssues from '../components/TopIssues.jsx';
import IncidentStreakBanner from '../components/IncidentStreakBanner.jsx';
import ExecutiveReportButton from '../components/ExecutiveReportButton.jsx';
import LocationHealthPanel from '../components/LocationHealthPanel.jsx';
import TvMode from '../components/TvMode.jsx';
import ServerHealthPanel from '../components/ServerHealthPanel.jsx';
import HistoryPanel from '../components/HistoryPanel.jsx';
import ToastContainer from '../components/ToastContainer.jsx';
import CommandPalette from '../components/CommandPalette.jsx';
import { showToast } from '../utils/toast.js';
import { fireDesktopAlert } from '../utils/desktopAlerts.js';

const THEME_KEY = 'ip_dashboard_theme';
const POLL_MS = 15000;

function reveal(index) {
  return { animation: 'fadeInUp .5s ease both', animationDelay: `${index * 0.06}s` };
}

function computeSummary(devices) {
  const enabled = devices.filter((d) => d.enabled);
  const summary = { total: enabled.length, online: 0, offline: 0, degraded: 0, unknown: 0 };
  for (const d of enabled) summary[d.status] = (summary[d.status] || 0) + 1;
  return summary;
}

export default function Dashboard({ user, onLogout, settings, reloadSettings }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshHover, setRefreshHover] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [tvMode, setTvMode] = useState(false);

  const [devices, setDevices] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [identifyingId, setIdentifyingId] = useState(null);
  const [identifyingAll, setIdentifyingAll] = useState(false);

  const topRef = useRef(null);
  const devicesSectionRef = useRef(null);
  const alertsSectionRef = useRef(null);
  const chartSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const serverSectionRef = useRef(null);

  const colors = getColors(theme);
  const isDark = theme === 'dark';

  const scrollToSection = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const loadAll = useCallback(async () => {
    const [devicesRes, alertsRes] = await Promise.all([api.devices(), api.alerts()]);
    setDevices(devicesRes.data);
    setAlerts(alertsRes.data);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const interval = setInterval(loadAll, POLL_MS);
    return () => clearInterval(interval);
  }, [loadAll]);

  useEffect(() => {
    const disconnect = connectLiveSocket((msg) => {
      if (msg.type === 'devices:update') {
        setMonitoring(true);
        setDevices((current) => {
          if (!current) return current;
          const byId = new Map(current.map((d) => [d.id, d]));
          for (const updated of msg.payload) {
            const existing = byId.get(updated.id);
            if (existing) {
              const noMaintenance = !existing.maintenanceUntil || new Date(existing.maintenanceUntil) <= new Date();
              if (existing.status !== 'offline' && updated.status === 'offline' && noMaintenance) {
                fireDesktopAlert('Dispositivo offline', `${existing.name} (${existing.ip}) parou de responder.`);
              }
              byId.set(updated.id, { ...existing, status: updated.status, latencyMs: updated.latencyMs, lastCheckAt: updated.lastCheckAt });
            }
          }
          return Array.from(byId.values());
        });
      }
    });
    return disconnect;
  }, []);

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setTimeout(() => setRefreshing(false), 400); }
  }, [loadAll]);

  async function handleSelectDevice(device) {
    const full = await api.deviceDetail(device.id);
    setSelectedDevice(full);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#device/${device.id}`);
  }

  function handleCloseDeviceModal() {
    setSelectedDevice(null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  // Deep link (#device/123): abre o detalhe direto ao carregar — usado pelo
  // QR code por dispositivo, pra escanear e cair exatamente naquela tela.
  useEffect(() => {
    if (!devices) return;
    const match = window.location.hash.match(/^#device\/(\d+)$/);
    if (match && !selectedDevice) {
      const device = devices.find((d) => d.id === Number(match[1]));
      if (device) handleSelectDevice(device);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  async function handleSaveDevice(id, data) {
    const ports = data.ports.split(',').map((p) => p.trim()).filter(Boolean);
    await api.updateDevice(id, { ...data, ports });
    await loadAll();
    setSelectedDevice(null);
  }

  async function handleDeleteDevice(id) {
    await api.deleteDevice(id);
    setSelectedDevice(null);
    await loadAll();
  }

  async function handleToggleFavorite(id, favorite) {
    setDevices((current) => current.map((d) => (d.id === id ? { ...d, favorite } : d)));
    if (selectedDevice?.id === id) setSelectedDevice((d) => ({ ...d, favorite }));
    try {
      await api.toggleFavorite(id, favorite);
    } catch (err) {
      showToast(`Erro ao favoritar: ${err.message}`, 'error');
      await loadAll();
    }
  }

  async function handleSetMaintenance(id, until) {
    try {
      const updated = await api.setMaintenance(id, until);
      setDevices((current) => current.map((d) => (d.id === id ? { ...d, maintenanceUntil: updated.maintenanceUntil } : d)));
      if (selectedDevice?.id === id) setSelectedDevice(updated);
      showToast(until ? 'Dispositivo em manutenção — alertas silenciados até o fim do período.' : 'Manutenção encerrada.', 'success');
    } catch (err) {
      showToast(`Erro ao atualizar manutenção: ${err.message}`, 'error');
    }
  }

  async function handleCheckNow(id) {
    setCheckingId(id);
    try {
      const updated = await api.checkDeviceNow(id);
      setSelectedDevice(updated);
      await loadAll();
    } finally {
      setCheckingId(null);
    }
  }

  async function handleIdentifyNow(id) {
    setIdentifyingId(id);
    try {
      const updated = await api.identifyDevice(id);
      setSelectedDevice(updated);
      await loadAll();
    } finally {
      setIdentifyingId(null);
    }
  }

  async function handleIdentifyAll() {
    setIdentifyingAll(true);
    try {
      const result = await api.identifyAll();
      await loadAll();
      const offlineNote = result.offline > 0 ? `\n${result.offline} estavam offline no momento — MAC só é possível para quem responde à rede.` : '';
      showToast(`Identificação concluída: ${result.processed} verificados — ${result.withMac} com MAC, ${result.withVendor} com fabricante, ${result.withModel} com modelo.${offlineNote}`, 'success');
    } catch (err) {
      showToast(`Erro ao identificar: ${err.message}`, 'error');
    } finally {
      setIdentifyingAll(false);
    }
  }

  async function handleCreateDevice(data) {
    const ports = data.ports.split(',').map((p) => p.trim()).filter(Boolean);
    await api.createDevice({ ...data, ports });
    await loadAll();
  }

  async function handleScan() {
    setScanning(true);
    try {
      const result = await api.scanNetwork({});
      await loadAll();
      showToast(`Varredura concluída: ${result.respondingCount} IPs responderam, ${result.createdCount} novos cadastrados e identificados automaticamente (confira nome/tipo/local na lista).`, 'success');
    } catch (err) {
      showToast(`Erro na varredura: ${err.message}`, 'error');
    } finally {
      setScanning(false);
    }
  }

  async function handleImport(file) {
    setImporting(true);
    try {
      const result = await api.importDevices(file);
      await loadAll();
      showToast(`Importação concluída: ${result.processed} processados, ${result.errors.length} com erro.`, result.errors.length > 0 ? 'info' : 'success');
    } catch (err) {
      showToast(`Erro ao importar: ${err.message}`, 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleExportCsv() {
    try {
      await api.exportDevicesCsv();
    } catch (err) {
      showToast(`Erro ao exportar CSV: ${err.message}`, 'error');
    }
  }

  async function handleExportPdf() {
    try {
      await api.exportDevicesPdf();
    } catch (err) {
      showToast(`Erro ao exportar PDF: ${err.message}`, 'error');
    }
  }

  if (!devices) {
    return <LoadingScreen colors={colors} label="Carregando dispositivos..." />;
  }

  const summary = computeSummary(devices);
  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const statusPill = summary.offline > 0
    ? { fg: colors.red, label: 'Dispositivos offline' }
    : summary.degraded > 0 || activeAlertsCount > 0
      ? { fg: colors.amber, label: 'Atenção' }
      : { fg: colors.green, label: 'Rede operacional' };

  const heroBanner = buildHeroBanner(colors, { summary, activeAlertsCount });
  const indicatorCards = buildIndicatorCards(colors, {
    summary, activeAlertsCount,
    onCardClick: {
      all: () => scrollToSection(devicesSectionRef),
      online: () => scrollToSection(devicesSectionRef),
      offline: () => scrollToSection(devicesSectionRef),
      degraded: () => scrollToSection(devicesSectionRef),
      alerts: () => scrollToSection(alertsSectionRef),
    },
  });

  const navItems = [
    { key: 'overview', label: 'Visão geral', icon: ICONS.network, onClick: () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { key: 'devices', label: 'Dispositivos', icon: ICONS.server, onClick: () => scrollToSection(devicesSectionRef) },
    { key: 'chart', label: 'Análise de rede', icon: ICONS.clock, onClick: () => scrollToSection(chartSectionRef) },
    { key: 'alerts', label: 'Alertas', icon: ICONS.warningTriangle, onClick: () => scrollToSection(alertsSectionRef) },
    { key: 'history', label: 'Histórico', icon: ICONS.clock, onClick: () => scrollToSection(historySectionRef) },
    { key: 'server', label: 'Servidor', icon: ICONS.server, onClick: () => scrollToSection(serverSectionRef) },
  ];

  return (
    <div style={{ background: colors.pageGradient, minHeight: '100vh', display: 'flex', transition: 'background .2s ease' }}>
      <Sidebar
        colors={colors}
        companyName={settings.companyName}
        siteName={settings.siteName}
        logoUrl={settings.logoUrl}
        statusPill={statusPill}
        navItems={navItems}
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
        user={user}
        onLogout={onLogout}
        onOpenSettings={user?.role === 'admin' ? () => { setShowSettings(true); setSidebarOpen(false); } : undefined}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className={`app-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className="app-main-content" style={{ flex: 1, minWidth: 0, padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Manrope',sans-serif" }}>

        <div className="app-mobile-topbar" style={{ alignItems: 'center', gap: 12, background: colors.header.gradient, borderRadius: 14, padding: '12px 16px', margin: '0 0 4px' }}>
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${colors.header.glassBorder}`, background: colors.header.glassBg, color: colors.header.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icon paths={ICONS.menu} size={17} strokeWidth={2.2} />
          </button>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 650, fontSize: 15, color: colors.header.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {settings.companyName}
          </div>
        </div>

        <TopBar colors={colors} monitoring={monitoring} onEnterTvMode={() => setTvMode(true)} />

        <div ref={topRef} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, scrollMarginTop: 20 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.01em' }}>
              {settings.siteName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.textSecondary, marginTop: 5 }}>
              Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <button
            onClick={handleRefresh}
            onMouseEnter={() => setRefreshHover(true)}
            onMouseLeave={() => setRefreshHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${colors.border}`,
              background: refreshHover ? colors.primary : colors.bgCard, color: refreshHover ? '#fff' : colors.textPrimary,
              borderRadius: 12, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              transition: 'transform .15s ease, box-shadow .15s ease, background .15s ease, color .15s ease',
              transform: refreshHover ? 'translateY(-2px)' : 'none',
              boxShadow: refreshHover ? colors.shadowHover : colors.shadow,
            }}
          >
            <span style={{ display: 'inline-flex', animation: refreshing ? 'spinIcon 0.7s linear infinite' : 'none' }}>
              <Icon paths={ICONS.refresh} size={15} strokeWidth={2.4} />
            </span>
            Atualizar
          </button>
        </div>

        <HeroBanner colors={colors} banner={heroBanner} />

        <IncidentStreakBanner colors={colors} />

        <IndicatorCards colors={colors} cards={indicatorCards} />

        <div ref={devicesSectionRef} style={{ ...reveal(1), scrollMarginTop: 20 }}>
          <DevicesPanel
            colors={colors}
            devices={devices}
            onSelectDevice={handleSelectDevice}
            onAddDevice={() => setShowAddModal(true)}
            onScan={handleScan}
            onImport={handleImport}
            onExportCsv={handleExportCsv}
            onExportPdf={handleExportPdf}
            onIdentifyAll={handleIdentifyAll}
            onToggleFavorite={handleToggleFavorite}
            scanning={scanning}
            importing={importing}
            identifying={identifyingAll}
          />
        </div>

        <div ref={chartSectionRef} style={{ ...reveal(2), scrollMarginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ExecutiveReportButton colors={colors} />
          </div>
          <NetworkHistoryChart colors={colors} />
          <LatencyChart colors={colors} />
          <LocationHealthPanel colors={colors} devices={devices} />
          <TopIssues colors={colors} devices={devices} icons={ICONS} />
        </div>

        <div style={{ ...reveal(3), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(380px,100%),1fr))', gap: 16, alignItems: 'start' }}>
          <div ref={alertsSectionRef} style={{ scrollMarginTop: 20 }}>
            <AlertsPanel colors={colors} alerts={alerts} />
          </div>
          <div ref={serverSectionRef} style={{ scrollMarginTop: 20 }}>
            <ServerHealthPanel colors={colors} />
          </div>
        </div>

        <div ref={historySectionRef} style={{ ...reveal(4), scrollMarginTop: 20 }}>
          <HistoryPanel colors={colors} />
        </div>

      </div>

      {showSettings && (
        <SettingsModal
          colors={colors}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={reloadSettings}
          currentUsername={user?.username}
        />
      )}

      {showAddModal && (
        <AddDeviceModal colors={colors} onClose={() => setShowAddModal(false)} onCreate={handleCreateDevice} />
      )}

      {selectedDevice && (
        <DeviceDetailModal
          colors={colors}
          device={selectedDevice}
          onClose={handleCloseDeviceModal}
          onSave={handleSaveDevice}
          onDelete={handleDeleteDevice}
          onCheckNow={handleCheckNow}
          onIdentifyNow={handleIdentifyNow}
          onToggleFavorite={handleToggleFavorite}
          onSetMaintenance={handleSetMaintenance}
          checking={checkingId === selectedDevice.id}
          identifying={identifyingId === selectedDevice.id}
        />
      )}

      <CommandPalette colors={colors} devices={devices} onSelectDevice={handleSelectDevice} />
      <ToastContainer colors={colors} />

      {tvMode && (
        <TvMode
          colors={colors}
          devices={devices}
          alerts={alerts}
          heroBanner={heroBanner}
          indicatorCards={indicatorCards}
          onExit={() => setTvMode(false)}
        />
      )}
    </div>
  );
}
