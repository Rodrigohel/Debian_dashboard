import { useState } from 'react';
import Icon, { ICONS, TYPE_META } from './Icon.jsx';

const STATUS_META = {
  online: { label: 'Online', color: 'green' },
  offline: { label: 'Offline', color: 'red' },
  degraded: { label: 'Degradado', color: 'amber' },
  unknown: { label: 'Verificando...', color: 'gray' },
};

const EVENT_LABEL = {
  went_offline: 'Ficou offline',
  went_online: 'Voltou online',
  degraded: 'Ficou degradado',
};

function Sparkline({ colors, checks }) {
  if (!checks || checks.length < 2) {
    return <div style={{ fontSize: 12.5, color: colors.textTertiary, padding: '12px 0' }}>Ainda não há histórico suficiente de latência.</div>;
  }
  const width = 100, height = 32, pad = 2;
  const values = checks.map((c) => (c.ok ? (c.latencyMs ?? 0) : null));
  const knownValues = values.filter((v) => v != null);
  const max = Math.max(1, ...knownValues);
  const stepX = (width - pad * 2) / (checks.length - 1);

  const points = checks.map((c, i) => {
    const x = pad + i * stepX;
    const y = c.ok ? height - pad - ((c.latencyMs ?? 0) / max) * (height - pad * 2) : height - pad;
    return { x, y, ok: c.ok };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg width="100%" height={40} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={linePath} fill="none" stroke={colors.primary} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => !p.ok && (
        <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={colors.red} />
      ))}
    </svg>
  );
}

export default function DeviceDetailModal({
  colors, device, onClose, onSave, onDelete, onCheckNow, checking,
}) {
  const [form, setForm] = useState({
    name: device.name, type: device.type, location: device.location,
    ports: device.ports.join(', '), notes: device.notes, enabled: device.enabled,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const statusMeta = STATUS_META[device.status] || STATUS_META.unknown;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave(device.id, { ...form, ip: device.ip });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{ width: '100%', maxWidth: 520, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '24px 26px', boxShadow: colors.shadow, overflowY: 'auto', position: 'relative' }}
      >
        <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon paths={(TYPE_META[device.type] || TYPE_META.outro).icon} size={20} color={colors.textSecondary} strokeWidth={2} />
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: colors.textPrimary }}>{device.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontSize: 13, color: colors.textSecondary }}>
          <span style={{ fontFamily: 'monospace' }}>{device.ip}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: colors[statusMeta.color] }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: colors[statusMeta.color] }} /> {statusMeta.label}
          </span>
        </div>

        <div style={{ background: colors.bgCardAlt, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Latência recente</div>
          <Sparkline colors={colors} checks={device.recentChecks} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Tipo</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13 }}>
              {Object.entries(TYPE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Local</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Portas TCP (opcional)</label>
            <input value={form.ports} onChange={(e) => setForm({ ...form, ports: e.target.value })} placeholder="ex.: 80, 554" style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13 }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Notas</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.textSecondary, marginBottom: 18, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Monitoramento ativo para este dispositivo
        </label>

        {device.recentEvents?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Eventos recentes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
              {device.recentEvents.map((ev, i) => (
                <div key={i} style={{ fontSize: 12.5, color: colors.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{EVENT_LABEL[ev.eventType] || ev.eventType}</span>
                  <span style={{ color: colors.textTertiary }}>{new Date(ev.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, border: 'none', background: colors.primary, color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          <button onClick={() => onCheckNow(device.id)} disabled={checking} style={{ border: `1px solid ${colors.border}`, background: colors.bgCard, color: colors.textPrimary, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon paths={ICONS.refresh} size={14} strokeWidth={2.2} /> {checking ? 'Testando...' : 'Testar agora'}
          </button>
          <button
            onClick={() => { if (confirm(`Remover "${device.name}" (${device.ip}) do monitoramento?`)) onDelete(device.id); }}
            style={{ border: `1px solid ${colors.redSoft}`, background: 'transparent', color: colors.red, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon paths={ICONS.trash} size={14} strokeWidth={2.2} /> Remover
          </button>
        </div>
      </div>
    </div>
  );
}
