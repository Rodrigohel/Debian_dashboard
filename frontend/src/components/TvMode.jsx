import { useEffect, useRef, useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';
import HeroBanner from './HeroBanner.jsx';
import IndicatorCards from './IndicatorCards.jsx';
import IncidentStreakBanner from './IncidentStreakBanner.jsx';
import LocationHealthPanel from './LocationHealthPanel.jsx';
import NetworkHistoryChart from './NetworkHistoryChart.jsx';
import LatencyChart from './LatencyChart.jsx';
import TopIssues from './TopIssues.jsx';
import AlertsPanel from './AlertsPanel.jsx';
import ServerHealthPanel from './ServerHealthPanel.jsx';

const SLIDE_SECONDS = 15;

// Modo parede/TV: tela cheia, sem interação, alternando entre os painéis
// principais sozinho — pensado pra um monitor fixo numa portaria/sala de
// controle, tipo NOC. Esc ou clique no X volta ao painel normal.
export default function TvMode({ colors, devices, alerts, heroBanner, indicatorCards, onExit }) {
  const [slide, setSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef(null);

  const slides = [
    {
      label: 'Visão geral',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <HeroBanner colors={colors} banner={heroBanner} />
          <IncidentStreakBanner colors={colors} />
          <IndicatorCards colors={colors} cards={indicatorCards} />
        </div>
      ),
    },
    {
      label: 'Análise de rede',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <NetworkHistoryChart colors={colors} />
          <LatencyChart colors={colors} />
        </div>
      ),
    },
    {
      label: 'Destaques',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <LocationHealthPanel colors={colors} devices={devices} />
          <TopIssues colors={colors} devices={devices} icons={ICONS} />
        </div>
      ),
    },
    {
      label: 'Alertas e servidor',
      render: () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(420px,100%),1fr))', gap: 20, alignItems: 'start' }}>
          <AlertsPanel colors={colors} alerts={alerts} />
          <ServerHealthPanel colors={colors} />
        </div>
      ),
    },
  ];

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    function handleFullscreenChange() {
      if (!document.fullscreenElement) onExit();
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    function handleKey(e) { if (e.key === 'Escape') onExit(); }
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProgress(0);
    const tickMs = 100;
    const ticks = (SLIDE_SECONDS * 1000) / tickMs;
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      setProgress(count / ticks);
      if (count >= ticks) setSlide((s) => (s + 1) % slides.length);
    }, tickMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: colors.pageGradient, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {slides.map((s, i) => (
            <div key={s.label} style={{ width: 90, height: 4, borderRadius: 99, background: colors.border, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, background: colors.primary,
                width: i < slide ? '100%' : i === slide ? `${progress * 100}%` : '0%',
                transition: i === slide ? 'none' : 'width .2s ease',
              }} />
            </div>
          ))}
        </div>
        <button
          onClick={onExit}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, background: colors.bgCard, color: colors.textSecondary, borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          <Icon paths={ICONS.close} size={13} strokeWidth={2.4} /> Sair (Esc)
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 40px' }} key={slide}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
          {slides[slide].label}
        </div>
        <div style={{ animation: 'fadeInUp .4s ease both' }}>
          {slides[slide].render()}
        </div>
      </div>
    </div>
  );
}
