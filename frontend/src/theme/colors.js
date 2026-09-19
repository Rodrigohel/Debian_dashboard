// Mesma paleta usada no painel PBX de referência, para manter os dois
// dashboards com a mesma identidade visual.
export function getColors(theme) {
  const dark = theme === 'dark';
  return {
    bgPage: dark ? '#0B1220' : '#F4F6FB',
    pageGradient: dark
      ? 'radial-gradient(1100px circle at 8% -10%, rgba(37,99,235,0.16) 0%, transparent 55%), radial-gradient(900px circle at 100% 0%, rgba(124,58,237,0.10) 0%, transparent 50%), #0B1220'
      : 'radial-gradient(1100px circle at 8% -10%, rgba(37,99,235,0.09) 0%, transparent 55%), radial-gradient(900px circle at 100% 0%, rgba(124,58,237,0.06) 0%, transparent 50%), #F4F6FB',
    bgCard: dark ? '#1A2436' : '#FFFFFF',
    bgCardAlt: dark ? '#141D2C' : '#F8FAFC',
    border: dark ? '#243046' : '#E2E8F0',
    textPrimary: dark ? '#F1F5F9' : '#0F172A',
    textSecondary: dark ? '#94A3B8' : '#64748B',
    textTertiary: dark ? '#64748B' : '#94A3B8',
    shadow: dark
      ? '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -8px rgba(0,0,0,0.5)'
      : '0 1px 2px rgba(15,23,42,0.04), 0 12px 28px -10px rgba(15,23,42,0.12)',
    shadowHover: dark
      ? '0 2px 4px rgba(0,0,0,0.45), 0 20px 40px -12px rgba(0,0,0,0.6)'
      : '0 2px 4px rgba(15,23,42,0.06), 0 20px 36px -12px rgba(15,23,42,0.18)',
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    primarySoft: dark ? 'rgba(37,99,235,0.18)' : '#DBEAFE',
    primaryGradient: dark
      ? 'linear-gradient(135deg, #1E3A8A 0%, #1E293B 100%)'
      : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    green: '#16A34A',
    greenSoft: dark ? 'rgba(22,163,74,0.18)' : '#DCFCE7',
    amber: '#F59E0B',
    amberSoft: dark ? 'rgba(245,158,11,0.18)' : '#FEF3C7',
    red: '#DC2626',
    redSoft: dark ? 'rgba(220,38,38,0.18)' : '#FEE2E2',
    gray: '#334155',
    graySoft: dark ? 'rgba(100,116,139,0.18)' : '#F1F5F9',
    header: {
      gradient: 'linear-gradient(120deg, #0F172A 0%, #1E3A8A 55%, #1D2B6B 100%)',
      text: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textTertiary: '#93A4C3',
      glassBg: 'rgba(255,255,255,0.08)',
      glassBgHover: 'rgba(255,255,255,0.18)',
      glassBorder: 'rgba(255,255,255,0.14)',
      glassBorderHover: 'rgba(255,255,255,0.35)',
    },
  };
}
