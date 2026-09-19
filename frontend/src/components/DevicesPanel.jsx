import { useMemo, useRef, useState } from 'react';
import Icon, { ICONS, TYPE_META } from './Icon.jsx';

const STATUS_META = {
  online: { label: 'Online', color: 'green' },
  offline: { label: 'Offline', color: 'red' },
  degraded: { label: 'Degradado', color: 'amber' },
  unknown: { label: 'Verificando...', color: 'gray' },
};

function timeAgo(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diffMs / 1000);
  if (secs < 60) return `${secs}s atrás`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.round(mins / 60);
  return `${hours}h atrás`;
}

function StatusDot({ colors, status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: colors[meta.color],
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 99, background: colors[meta.color],
        animation: status === 'offline' ? 'pulseDot 1.4s ease-in-out infinite' : 'none',
      }} />
      {meta.label}
    </span>
  );
}

function ToolbarButton({ colors, onClick, children, disabled, primary }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${primary ? colors.primary : colors.border}`,
        background: primary ? colors.primary : (hover ? colors.bgCardAlt : colors.bgCard),
        color: primary ? '#fff' : colors.textPrimary,
        borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function FilterChip({ colors, active, onClick, label, count, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? color : colors.border}`,
        background: active ? `${color}1A` : colors.bgCard, color: active ? color : colors.textSecondary,
        borderRadius: 99, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {label} <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

export default function DevicesPanel({
  colors, devices, onSelectDevice, onAddDevice, onScan, onImport, onExport, scanning, importing,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  const counts = useMemo(() => {
    const c = { all: devices.length, online: 0, offline: 0, degraded: 0, unknown: 0 };
    const byType = {};
    for (const d of devices) {
      c[d.status] = (c[d.status] || 0) + 1;
      byType[d.type] = (byType[d.type] || 0) + 1;
    }
    return { status: c, byType };
  }, [devices]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return devices.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter && d.type !== typeFilter) return false;
      if (needle && !(d.name.toLowerCase().includes(needle) || d.ip.includes(needle) || d.location.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [devices, statusFilter, typeFilter, search]);

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>
          Dispositivos ({devices.length})
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ToolbarButton colors={colors} primary onClick={onAddDevice}>
            <Icon paths={ICONS.plus} size={14} strokeWidth={2.4} /> Adicionar
          </ToolbarButton>
          <ToolbarButton colors={colors} onClick={onScan} disabled={scanning}>
            <Icon paths={ICONS.scan} size={14} strokeWidth={2.2} /> {scanning ? 'Escaneando...' : 'Escanear rede'}
          </ToolbarButton>
          <ToolbarButton colors={colors} onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Icon paths={ICONS.upload} size={14} strokeWidth={2.2} /> {importing ? 'Importando...' : 'Importar CSV'}
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
          />
          <ToolbarButton colors={colors} onClick={onExport}>
            <Icon paths={ICONS.download} size={14} strokeWidth={2.2} /> Exportar CSV
          </ToolbarButton>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterChip colors={colors} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="Todos" count={counts.status.all} color={colors.gray} />
        <FilterChip colors={colors} active={statusFilter === 'online'} onClick={() => setStatusFilter('online')} label="Online" count={counts.status.online || 0} color={colors.green} />
        <FilterChip colors={colors} active={statusFilter === 'offline'} onClick={() => setStatusFilter('offline')} label="Offline" count={counts.status.offline || 0} color={colors.red} />
        <FilterChip colors={colors} active={statusFilter === 'degraded'} onClick={() => setStatusFilter('degraded')} label="Degradado" count={counts.status.degraded || 0} color={colors.amber} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip colors={colors} active={!typeFilter} onClick={() => setTypeFilter(null)} label="Todos os tipos" count={devices.length} color={colors.primary} />
          {Object.entries(counts.byType).map(([type, count]) => (
            <FilterChip key={type} colors={colors} active={typeFilter === type} onClick={() => setTypeFilter(type)} label={TYPE_META[type]?.label || type} count={count} color={colors.primary} />
          ))}
        </div>
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }}>
            <Icon paths={ICONS.search} size={14} strokeWidth={2.2} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, IP ou local..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ maxHeight: 520, overflowY: 'auto', borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: colors.bgCardAlt, zIndex: 1 }}>
              {['Status', 'Nome', 'IP', 'Tipo', 'Local', 'Latência', 'Última checagem'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: colors.textTertiary, borderBottom: `1px solid ${colors.border}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const typeMeta = TYPE_META[d.type] || TYPE_META.outro;
              return (
                <tr
                  key={d.id}
                  onClick={() => onSelectDevice(d)}
                  style={{ cursor: 'pointer', borderBottom: `1px solid ${colors.border}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgCardAlt; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '10px 14px' }}><StatusDot colors={colors} status={d.status} /></td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: colors.textPrimary }}>{d.name}</td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary, fontFamily: 'monospace' }}>{d.ip}</td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon paths={typeMeta.icon} size={13} strokeWidth={2} color={colors.textTertiary} /> {typeMeta.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{d.location || '—'}</td>
                  <td style={{ padding: '10px 14px', color: colors.textSecondary }}>{d.latencyMs != null ? `${d.latencyMs.toFixed(0)} ms` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: colors.textTertiary }}>{timeAgo(d.lastCheckAt)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '24px 14px', textAlign: 'center', color: colors.textSecondary }}>
                  Nenhum dispositivo encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
