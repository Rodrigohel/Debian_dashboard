import { useState } from 'react';
import { api } from '../api/client.js';
import { showToast } from '../utils/toast.js';
import Icon, { ICONS } from './Icon.jsx';

const PERIODS = [
  { key: 7, label: '7 dias' },
  { key: 30, label: '30 dias' },
];

// Relatório de uma página (uptime, incidentes, latência, top instáveis) pra
// imprimir/anexar num e-mail de status — diferente do "Exportar PDF" da
// lista de dispositivos, que é a ficha técnica completa de cada um.
export default function ExecutiveReportButton({ colors }) {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      await api.executiveReportPdf(days);
    } catch (err) {
      showToast(`Erro ao gerar relatório: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{ border: `1px solid ${colors.border}`, background: colors.bgCard, color: colors.textSecondary, borderRadius: 10, padding: '8px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
      >
        {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${colors.border}`, background: colors.bgCard,
          color: colors.textPrimary, borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        <Icon paths={ICONS.download} size={13} strokeWidth={2.2} />
        {loading ? 'Gerando...' : 'Relatório executivo'}
      </button>
    </div>
  );
}
