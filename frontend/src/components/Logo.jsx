import Icon, { ICONS } from './Icon.jsx';
import { resolveAssetUrl } from '../api/client.js';

// Mostra o logo configurado em Configurações (logoUrl vindo do backend)
// quando existir; caso contrário, cai no ícone padrão do painel.
export default function Logo({ colors, size = 44, logoUrl }) {
  if (logoUrl) {
    return (
      <img
        src={resolveAssetUrl(logoUrl)}
        alt="Logo"
        style={{ width: size, height: size, borderRadius: 12, objectFit: 'contain', background: colors.primarySoft, flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: colors.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon paths={ICONS.network} size={Math.round(size / 2)} color={colors.primary} strokeWidth={2} />
    </div>
  );
}
