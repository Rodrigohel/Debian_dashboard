import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS, TYPE_META } from './Icon.jsx';

const EVENT_META = {
  went_offline: { label: 'Ficou offline', color: 'red', icon: ICONS.offline },
  went_online: { label: 'Voltou online', color: 'green', icon: ICONS.check },
  degraded: { label: 'Ficou degradado', color: 'amber', icon: ICONS.warningTriangle },
};

function formatDuration(ms) {
  if (ms == null) return '—';
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min`;
  return '<1min';
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPanel({ colors }) {
  const [events, setEvents] = useState(null);
  const [eventType, setEventType] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { eventType: eventType || undefined, limit: 300 };
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(to).toISOString();
      const result = await api.eventsHistory(params);
      setEvents(result.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [eventType, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = search.trim().toLowerCase();
  const filtered = (events || []).filter((e) => (
    !needle || e.device.name.toLowerCase().includes(needle) || e.device.ip.includes(needle)
  ));

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>
          Histórico de queda e recuperação
        </div>
        <button
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.border}`, background: colors.bgCard, color: colors.textPrimary, borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
        >
          <Icon paths={ICONS.refresh} size={13} strokeWidth={2.2} /> Atualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 12.5 }}>
          <option value="">Todos os eventos</option>
          <option value="went_offline">Ficou offline</option>
          <option value="went_online">Voltou online</option>
          <option value="degraded">Ficou degradado</option>
        </select>
        <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 12.5 }} />
        <span style={{ alignSelf: 'center', color: colors.textTertiary, fontSize: 12.5 }}>até</span>
        <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 12.5 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por nome ou IP..."
          style={{ flex: 1, minWidth: 180, padding: '7px 10px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 12.5 }}
        />
      </div>

      <div style={{ maxHeight: 480, overflow: 'auto', borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: colors.bgCardAlt, zIndex: 1 }}>
              {['Evento', 'Dispositivo', 'IP', 'Tipo', 'Quando', 'Duração do estado anterior'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: colors.textTertiary, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: '20px 14px', textAlign: 'center', color: colors.textSecondary }}>Carregando...</td></tr>
            )}
            {!loading && filtered.map((e) => {
              const meta = EVENT_META[e.eventType] || { label: e.eventLabel, color: 'gray', icon: ICONS.info };
              const typeMeta = TYPE_META[e.device.type] || TYPE_META.outro;
              return (
                <tr key={e.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, color: colors[meta.color] }}>
                      <Icon paths={meta.icon} size={13} strokeWidth={2.2} color={colors[meta.color]} /> {meta.label}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap' }}>{e.device.name}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: colors.textSecondary, whiteSpace: 'nowrap' }}>{e.device.ip}</td>
                  <td style={{ padding: '9px 14px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon paths={typeMeta.icon} size={12} strokeWidth={2} color={colors.textTertiary} /> {typeMeta.label}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</td>
                  <td style={{ padding: '9px 14px', color: colors.textTertiary, whiteSpace: 'nowrap' }}>{formatDuration(e.durationMs)}</td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '24px 14px', textAlign: 'center', color: colors.textSecondary }}>Nenhum evento encontrado nesse período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
