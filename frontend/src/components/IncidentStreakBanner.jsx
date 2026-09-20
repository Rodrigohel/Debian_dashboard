import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';

// Conta de 0 até `target` em ~900ms com desaceleração — um contador estático
// não comunica "ao vivo"; a pequena animação é o que faz parecer um painel
// de operação de verdade em vez de um número solto na tela.
function useCountUp(target, durationMs = 900) {
  const [value, setValue] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    if (target == null) { setValue(0); return; }
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, durationMs]);

  return value;
}

// "Dias sem incidente" — clássico painel de operação (tipo placa de fábrica
// "X dias sem acidente"): dá pra ver de longe se a rede está tranquila.
export default function IncidentStreakBanner({ colors }) {
  const [streak, setStreak] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api.incidentStreak().then((res) => { if (!cancelled) setStreak(res); }).catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const days = useCountUp(streak?.days ?? null);

  if (streak === undefined) return null;

  const recentIncident = streak.days === 0;
  const noHistory = streak.days == null;
  const color = noHistory ? colors.textSecondary : recentIncident ? colors.amber : colors.green;
  const bg = noHistory ? colors.bgCardAlt : recentIncident ? `${colors.amber}14` : `${colors.green}14`;
  const border = noHistory ? colors.border : recentIncident ? `${colors.amber}55` : `${colors.green}55`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, background: bg, border: `1px solid ${border}`,
      borderRadius: 16, padding: '16px 22px', boxShadow: colors.shadow,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: noHistory ? colors.bgCard : `${color}22`,
      }}>
        <Icon paths={ICONS.check} size={22} strokeWidth={2.4} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        {noHistory ? (
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>Sem incidentes registrados ainda</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{days}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                {days === 1 ? 'dia sem incidente crítico' : 'dias sem incidente crítico'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              {recentIncident
                ? 'Um dispositivo ficou offline nas últimas 24h.'
                : `Desde ${new Date(streak.since).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
