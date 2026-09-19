export default function LoadingScreen({ colors, label = 'Carregando...' }) {
  const bg = colors?.bgPage || '#F4F6FB';
  const primary = colors?.primary || '#2563EB';
  const border = colors?.border || '#E2E8F0';
  const text = colors?.textSecondary || '#64748B';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: bg, fontFamily: "'Manrope',sans-serif" }}>
      <div style={{ position: 'relative', width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ animation: 'spinIcon 0.9s linear infinite' }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke={border} strokeWidth="4" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={primary} strokeWidth="4" strokeLinecap="round" strokeDasharray="70 200" />
        </svg>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: text }}>{label}</div>
    </div>
  );
}
