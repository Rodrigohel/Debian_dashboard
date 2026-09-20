import { useEffect, useRef, useState } from 'react';
import Icon, { ICONS, TYPE_META } from './Icon.jsx';

const STATUS_COLOR = { online: 'green', offline: 'red', degraded: 'amber', unknown: 'gray' };

// Busca rápida global (Ctrl/Cmd+K) — digita nome, IP, MAC, fabricante ou
// local e pula direto pro detalhe do dispositivo, sem precisar rolar a
// tabela ou mexer em filtro nenhum.
export default function CommandPalette({ colors, devices, onSelectDevice }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isShortcut) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const results = needle
    ? devices.filter((d) => (
      d.name.toLowerCase().includes(needle) || d.ip.includes(needle) ||
      (d.mac || '').includes(needle) || (d.vendor || '').toLowerCase().includes(needle) ||
      (d.location || '').toLowerCase().includes(needle)
    )).slice(0, 8)
    : devices.filter((d) => d.favorite).slice(0, 8);

  function select(device) {
    onSelectDevice(device);
    setOpen(false);
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIndex]) { select(results[activeIndex]); }
  }

  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh', zIndex: 1200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, boxShadow: colors.shadowHover, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
          <Icon paths={ICONS.search} size={16} strokeWidth={2.2} color={colors.textTertiary} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKey}
            placeholder="Buscar dispositivo por nome, IP, MAC, fabricante..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14.5, color: colors.textPrimary, background: 'transparent' }}
          />
          <span style={{ fontSize: 10.5, color: colors.textTertiary, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '2px 6px' }}>ESC</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {!needle && results.length > 0 && (
            <div style={{ padding: '8px 16px 2px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: colors.textTertiary }}>Favoritos</div>
          )}
          {results.map((d, i) => {
            const typeMeta = TYPE_META[d.type] || TYPE_META.outro;
            const statusColor = colors[STATUS_COLOR[d.status] || 'gray'];
            return (
              <div
                key={d.id}
                onClick={() => select(d)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
                  background: activeIndex === i ? colors.bgCardAlt : 'transparent',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 99, background: statusColor, flexShrink: 0 }} />
                <Icon paths={typeMeta.icon} size={14} strokeWidth={2} color={colors.textTertiary} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.textTertiary, fontFamily: 'monospace' }}>{d.ip}{d.location ? ` — ${d.location}` : ''}</div>
                </div>
              </div>
            );
          })}
          {results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: colors.textSecondary }}>
              {needle ? 'Nenhum dispositivo encontrado.' : 'Nenhum favorito ainda — digite para buscar.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
