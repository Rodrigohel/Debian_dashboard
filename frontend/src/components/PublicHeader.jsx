import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

const STATUS_PILL = {
  operational: (c) => ({ fg: c.green, label: 'Operacional' }),
  degraded: (c) => ({ fg: c.amber, label: 'Atenção' }),
};

function IconButton({ h, onClick, title, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 38, height: 38, borderRadius: 11,
        border: `1px solid ${hover ? h.glassBorderHover : h.glassBorder}`,
        background: hover ? h.glassBgHover : h.glassBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        color: h.text, transition: 'border-color .15s ease, background .15s ease, transform .15s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

export default function PublicHeader({
  colors, companyName, siteName, logoUrl, status, lastUpdateLabel,
  onRefresh, refreshing, isDark, onToggleTheme, onLoginClick,
}) {
  const h = colors.header;
  const statusPill = status ? (STATUS_PILL[status.overall] || STATUS_PILL.operational)(colors) : null;
  const [loginHover, setLoginHover] = useState(false);

  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      background: h.gradient, borderRadius: 18, padding: '18px 24px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 20px 40px -14px rgba(15,23,42,0.55)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <Logo colors={colors} logoUrl={logoUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 650, fontSize: 17, color: h.text, lineHeight: 1.2 }}>{companyName}</div>
          <div style={{ fontSize: 13, color: h.textSecondary, marginTop: 2 }}>{siteName}</div>
        </div>
        {statusPill && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, background: h.glassBg, border: `1px solid ${h.glassBorder}`,
            color: h.text, padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, marginLeft: 8,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: statusPill.fg, animation: 'pulseDot 2s ease-in-out infinite' }} />
            {statusPill.label}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {lastUpdateLabel && (
          <div style={{ fontSize: 12, color: h.textTertiary }}>Atualizado {lastUpdateLabel}</div>
        )}

        <button
          onClick={onRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${h.glassBorder}`, background: h.glassBg,
            color: h.text, borderRadius: 11, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-flex', animation: refreshing ? 'spinIcon 0.7s linear infinite' : 'none' }}>
            <Icon paths={ICONS.refresh} size={15} strokeWidth={2.2} />
          </span>
          Atualizar
        </button>

        <IconButton h={h} onClick={onToggleTheme} title="Alternar tema">
          {isDark ? <Icon paths={ICONS.moon} size={16} strokeWidth={2} /> : <Icon paths={ICONS.sun} size={16} strokeWidth={2} />}
        </IconButton>

        <button
          onClick={onLoginClick}
          onMouseEnter={() => setLoginHover(true)}
          onMouseLeave={() => setLoginHover(false)}
          style={{
            border: 'none', background: loginHover ? '#FFFFFF' : '#F1F5F9', color: '#1E293B', borderRadius: 11,
            padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'transform .15s ease, box-shadow .15s ease, background .15s ease',
            transform: loginHover ? 'translateY(-2px)' : 'none',
            boxShadow: loginHover ? '0 8px 18px -6px rgba(0,0,0,0.35)' : '0 2px 6px -2px rgba(0,0,0,0.25)',
          }}
        >
          Entrar
        </button>
      </div>
    </header>
  );
}
