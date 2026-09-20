import { useState } from 'react';
import { TYPE_META } from './Icon.jsx';

export default function AddDeviceModal({ colors, onClose, onCreate }) {
  const [form, setForm] = useState({ ip: '', name: '', type: 'outro', location: '', ports: '', notes: '', username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate(form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '24px 26px', boxShadow: colors.shadow, position: 'relative' }}>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>

        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary, marginBottom: 18 }}>Adicionar dispositivo</div>

        <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>IP *</label>
            <input required value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="192.168.1.50" autoFocus style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Câmera Entrada" style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }}>
                {Object.entries(TYPE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Local</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex.: Bloco A" style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Portas TCP (opcional, separadas por vírgula)</label>
            <input value={form.ports} onChange={(e) => setForm({ ...form, ports: e.target.value })} placeholder="ex.: 80, 554" style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Usuário de acesso (opcional)</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="admin" autoComplete="off" style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>Senha de acesso (opcional)</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" autoComplete="off" style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 }} />
            </div>
          </div>
        </div>

        {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button type="submit" disabled={saving} style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Adicionando...' : 'Adicionar dispositivo'}
        </button>
      </form>
    </div>
  );
}
