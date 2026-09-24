import { useState } from 'react';
import Logo from './Logo.jsx';

export default function LoginModal({ colors, onLogin, onCompleteTotp, onClose, logoUrl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpToken, setTotpToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await onLogin(username, password);
      if (result?.requiresTotp) setTotpToken(result.totpToken);
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onCompleteTotp(totpToken, code);
    } catch (err) {
      setError(err.message || 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000,
      }}
    >
      {totpToken ? (
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleTotpSubmit}
          style={{ width: '100%', maxWidth: 360, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '28px 26px', boxShadow: colors.shadow, position: 'relative' }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>

          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary, marginBottom: 6 }}>Verificação em duas etapas</div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 20 }}>Digite o código do seu app autenticador (ou um código de recuperação).</div>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Código</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoFocus
            autoComplete="one-time-code"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 18, fontSize: 16, fontFamily: 'monospace', letterSpacing: '.08em', textAlign: 'center' }}
          />

          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Verificando...' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={() => { setTotpToken(null); setCode(''); setError(''); }}
            style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 12.5, cursor: 'pointer' }}
          >
            Voltar
          </button>
        </form>
      ) : (
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          style={{ width: '100%', maxWidth: 360, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '28px 26px', boxShadow: colors.shadow, position: 'relative' }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ position: 'absolute', top: 14, right: 14, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Logo colors={colors} logoUrl={logoUrl} />
            <div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>Entrar</div>
              <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Acesse o painel completo</div>
            </div>
          </div>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Usuário</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 14, fontSize: 14, fontFamily: 'inherit' }}
          />

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, marginBottom: 18, fontSize: 14, fontFamily: 'inherit' }}
          />

          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
