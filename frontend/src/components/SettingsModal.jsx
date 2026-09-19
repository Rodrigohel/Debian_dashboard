import { useState } from 'react';
import { api } from '../api/client.js';
import Icon, { ICONS } from './Icon.jsx';

function Field({ colors, label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = (colors) => ({ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${colors.border}`, fontSize: 13.5 });

export default function SettingsModal({ colors, settings, onClose, onSaved, currentUsername }) {
  const [form, setForm] = useState({
    companyName: settings.companyName || '',
    siteName: settings.siteName || '',
    pingIntervalSeconds: settings.pingIntervalSeconds || '20',
    pingTimeoutMs: settings.pingTimeoutMs || '1200',
    offlineThresholdFails: settings.offlineThresholdFails || '2',
    alertReminderIntervalMinutes: settings.alertReminderIntervalMinutes || '60',
    telegramBotToken: settings.telegramBotToken || '',
    telegramChatId: settings.telegramChatId || '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateSettings(form);
      if (logoFile) await api.uploadLogo(logoFile);
      await onSaved();
      setMessage('Configurações salvas.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestTelegram() {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      await api.testTelegram({ telegramBotToken: form.telegramBotToken, telegramChatId: form.telegramChatId });
      setMessage('Mensagem de teste enviada — confira o Telegram.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" style={{ width: '100%', maxWidth: 480, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '24px 26px', boxShadow: colors.shadow, overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Icon paths={ICONS.settings} size={18} color={colors.textPrimary} strokeWidth={2} />
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>Configurações</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Identidade</div>
        <Field colors={colors} label="Nome da empresa/condomínio">
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} style={inputStyle(colors)} />
        </Field>
        <Field colors={colors} label="Nome do painel">
          <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} style={inputStyle(colors)} />
        </Field>
        <Field colors={colors} label="Logo (PNG, JPG ou SVG)">
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={inputStyle(colors)} />
        </Field>

        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 10px' }}>Monitoramento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field colors={colors} label="Intervalo entre verificações (s)">
            <input type="number" min={5} value={form.pingIntervalSeconds} onChange={(e) => setForm({ ...form, pingIntervalSeconds: e.target.value })} style={inputStyle(colors)} />
          </Field>
          <Field colors={colors} label="Timeout do ping/porta (ms)">
            <input type="number" min={200} value={form.pingTimeoutMs} onChange={(e) => setForm({ ...form, pingTimeoutMs: e.target.value })} style={inputStyle(colors)} />
          </Field>
        </div>
        <Field colors={colors} label="Falhas seguidas até marcar OFFLINE" hint="Evita marcar como caído por causa de 1 pacote perdido isolado.">
          <input type="number" min={1} value={form.offlineThresholdFails} onChange={(e) => setForm({ ...form, offlineThresholdFails: e.target.value })} style={inputStyle(colors)} />
        </Field>
        <Field colors={colors} label="Lembrete de alerta ativo (min)" hint="0 desativa — manda só quando fica ativo e quando resolve.">
          <input type="number" min={0} value={form.alertReminderIntervalMinutes} onChange={(e) => setForm({ ...form, alertReminderIntervalMinutes: e.target.value })} style={inputStyle(colors)} />
        </Field>

        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 10px' }}>Notificação via Telegram (opcional)</div>
        <Field colors={colors} label="Bot Token">
          <input value={form.telegramBotToken} onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })} placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={inputStyle(colors)} />
        </Field>
        <Field colors={colors} label="Chat ID">
          <input value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} style={inputStyle(colors)} />
        </Field>
        <button
          type="button"
          onClick={handleTestTelegram}
          disabled={testing || !form.telegramBotToken || !form.telegramChatId}
          style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 18, opacity: (!form.telegramBotToken || !form.telegramChatId) ? 0.5 : 1 }}
        >
          {testing ? 'Enviando...' : 'Testar notificação'}
        </button>

        {currentUsername && (
          <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 14 }}>Logado como <strong>{currentUsername}</strong></div>
        )}

        {message && <div style={{ color: colors.green, fontSize: 13, marginBottom: 12 }}>{message}</div>}
        {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
