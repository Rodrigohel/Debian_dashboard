import { useState } from 'react';
import Icon, { ICONS } from './Icon.jsx';
import Logo from './Logo.jsx';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function NavItem({ h, icon, label, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
        border: 'none', background: hover || active ? h.glassBgHover : 'transparent',
        color: hover || active ? h.text : h.textSecondary,
        borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        transition: 'background .15s ease, color .15s ease',
      }}
    >
      <Icon paths={icon} size={16} strokeWidth={2} />
      {label}
    </button>
  );
}

function GhostIconButton({ h, onClick, title, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 34, height: 34, borderRadius: 9, border: `1px solid ${hover ? h.glassBorderHover : h.glassBorder}`,
        background: hover ? h.glassBgHover : h.glassBg, color: h.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'background .15s ease, border-color .15s ease',
      }}
    >
      {children}
    </button>
  );
}

export default function Sidebar({
  colors, companyName, siteName, logoUrl, statusPill, navItems,
  isDark, onToggleTheme, user, onLogout, onOpenSettings, open, onClose,
}) {
  const h = colors.header;
  const [logoutHover, setLogoutHover] = useState(false);

  return (
    <aside className={`app-sidebar${open ? ' is-open' : ''}`} style={{
      width: 252, flexShrink: 0, background: h.gradient, position: 'sticky', top: 0, height: '100vh',
      display: 'flex', flexDirection: 'column', padding: '22px 16px', gap: 20, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
        <Logo colors={colors} logoUrl={logoUrl} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 650, fontSize: 15, color: h.text, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {companyName}
          </div>
          <div style={{ fontSize: 12, color: h.textSecondary }}>{siteName}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            style={{
              width: 30, height: 30, borderRadius: 8, border: `1px solid ${h.glassBorder}`, background: h.glassBg,
              color: h.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Icon paths={ICONS.close} size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, background: h.glassBg, border: `1px solid ${h.glassBorder}`,
        color: h.text, padding: '7px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: statusPill.fg, animation: 'pulseDot 2s ease-in-out infinite' }} />
        {statusPill.label}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto', marginTop: 4 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: h.textTertiary, textTransform: 'uppercase', padding: '4px 12px 6px' }}>
          Navegação
        </div>
        {navItems.map((item) => (
          <NavItem
            key={item.key}
            h={h}
            icon={item.icon}
            label={item.label}
            onClick={() => { item.onClick(); onClose?.(); }}
          />
        ))}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${h.glassBorder}`, paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GhostIconButton h={h} onClick={onToggleTheme} title="Alternar tema">
            {isDark ? <Icon paths={ICONS.moon} size={15} strokeWidth={2} /> : <Icon paths={ICONS.sun} size={15} strokeWidth={2} />}
          </GhostIconButton>
          {onOpenSettings && (
            <GhostIconButton h={h} onClick={onOpenSettings} title="Configurações">
              <Icon paths={ICONS.settings} size={15} strokeWidth={2} />
            </GhostIconButton>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 99, background: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
            fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0,
          }}>
            {initials(user?.displayName)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: h.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.displayName}
            </div>
            <button
              onClick={onLogout}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: logoutHover ? '#FCA5A5' : h.textTertiary, transition: 'color .15s ease' }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
