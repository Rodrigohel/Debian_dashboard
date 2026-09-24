import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client.js';
import { showToast } from '../utils/toast.js';
import Icon, { ICONS } from './Icon.jsx';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function SectionLabel({ colors, children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 10px' }}>
      {children}
    </div>
  );
}

function TabButton({ colors, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none', borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
        background: 'transparent', color: active ? colors.primary : colors.textSecondary,
        padding: '8px 4px', marginRight: 18, fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function GeneralTab({ colors, form, setForm }) {
  return (
    <>
      <SectionLabel colors={colors}>Identidade</SectionLabel>
      <Field colors={colors} label="Nome da empresa/condomínio">
        <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} style={inputStyle(colors)} />
      </Field>
      <Field colors={colors} label="Nome do painel">
        <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} style={inputStyle(colors)} />
      </Field>
      <Field colors={colors} label="Logo (PNG, JPG ou SVG)">
        <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, logoFile: e.target.files?.[0] || null })} style={inputStyle(colors)} />
      </Field>

      <SectionLabel colors={colors}>Monitoramento</SectionLabel>
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

      <SectionLabel colors={colors}>Rede</SectionLabel>
      <Field colors={colors} label="Prefixo /24 usado pelo 'Escanear rede'" hint="Formato: 192.168.1 (sem o último número do IP).">
        <input value={form.networkBase} onChange={(e) => setForm({ ...form, networkBase: e.target.value })} placeholder="192.168.1" style={inputStyle(colors)} />
      </Field>
      <Field colors={colors} label="Reter histórico do gráfico de rede por (horas)" hint="168h = 7 dias. Não afeta o histórico de queda/recuperação por dispositivo, que fica guardado sem limite de tempo.">
        <input type="number" min={1} value={form.networkHistoryRetentionHours} onChange={(e) => setForm({ ...form, networkHistoryRetentionHours: e.target.value })} style={inputStyle(colors)} />
      </Field>
    </>
  );
}

function TelegramTab({ colors, form, setForm, onTest, testing }) {
  return (
    <>
      <SectionLabel colors={colors}>Notificação via Telegram (opcional)</SectionLabel>
      <Field colors={colors} label="Bot Token">
        <input value={form.telegramBotToken} onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })} placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxx" style={inputStyle(colors)} />
      </Field>
      <Field colors={colors} label="Chat ID">
        <input value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} style={inputStyle(colors)} />
      </Field>
      <button
        type="button"
        onClick={onTest}
        disabled={testing || !form.telegramBotToken || !form.telegramChatId}
        style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (!form.telegramBotToken || !form.telegramChatId) ? 0.5 : 1 }}
      >
        {testing ? 'Enviando...' : 'Testar notificação'}
      </button>

      <SectionLabel colors={colors}>Relatório executivo automático</SectionLabel>
      <Field colors={colors} label="Frequência de envio pelo Telegram" hint="Manda o mesmo PDF do botão 'Relatório executivo' sozinho, no bot/chat configurado acima — precisa dos dois campos preenchidos.">
        <select value={form.executiveReportFrequency} onChange={(e) => setForm({ ...form, executiveReportFrequency: e.target.value })} style={inputStyle(colors)}>
          <option value="off">Desativado</option>
          <option value="weekly">Semanal (últimos 7 dias)</option>
          <option value="monthly">Mensal (últimos 30 dias)</option>
        </select>
      </Field>

      <SectionLabel colors={colors}>Heartbeat ("estou vivo")</SectionLabel>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.textSecondary, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.heartbeatEnabled} onChange={(e) => setForm({ ...form, heartbeatEnabled: e.target.checked })} />
        Mandar uma mensagem periódica confirmando que o painel está ativo
      </label>
      <Field colors={colors} label="A cada quantas horas" hint="Se essa mensagem parar de chegar no intervalo esperado, é sinal de que o servidor caiu — não só o processo (isso o systemd já reinicia sozinho), mas a própria máquina, rede ou energia.">
        <input type="number" min={1} value={form.heartbeatFrequencyHours} onChange={(e) => setForm({ ...form, heartbeatFrequencyHours: e.target.value })} style={inputStyle(colors)} disabled={!form.heartbeatEnabled} />
      </Field>
    </>
  );
}

function UsersTab({ colors, currentUsername }) {
  const [users, setUsers] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', displayName: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => api.users().then(setUsers).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.createUser(newUser);
      setNewUser({ username: '', displayName: '', password: '', role: 'user' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id, username) {
    if (username === currentUsername) return showToast('Você não pode remover o próprio usuário logado.', 'error');
    if (!confirm(`Remover o usuário "${username}"?`)) return;
    try {
      await api.deleteUser(id);
      load();
      showToast(`Usuário "${username}" removido.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDisableTotp(id, username) {
    if (!confirm(`Desativar o 2FA de "${username}"? Use isso quando a pessoa perdeu o acesso ao app autenticador e aos códigos de recuperação.`)) return;
    try {
      await api.adminDisableTotp(id);
      load();
      showToast(`2FA de "${username}" desativado.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <>
      <SectionLabel colors={colors}>Usuários do painel</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {!users && <div style={{ fontSize: 13, color: colors.textSecondary }}>Carregando...</div>}
        {users?.map((u) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${colors.border}`, borderRadius: 9, padding: '8px 12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>{u.displayName} <span style={{ color: colors.textTertiary, fontWeight: 400 }}>({u.username})</span></div>
              <div style={{ fontSize: 11.5, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: 6 }}>
                {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                {!!u.totpEnabled && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: colors.green, fontWeight: 700 }}>
                    <Icon paths={ICONS.shield} size={11} strokeWidth={2.2} /> 2FA
                  </span>
                )}
              </div>
            </div>
            {!!u.totpEnabled && (
              <button
                onClick={() => handleDisableTotp(u.id, u.username)}
                title="Desativar 2FA (se a pessoa perdeu o acesso)"
                style={{ border: 'none', background: 'transparent', color: colors.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <Icon paths={ICONS.shield} size={14} strokeWidth={2.2} />
              </button>
            )}
            <button
              onClick={() => handleDelete(u.id, u.username)}
              title="Remover"
              style={{ border: 'none', background: 'transparent', color: colors.red, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
            >
              <Icon paths={ICONS.trash} size={14} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>

      <SectionLabel colors={colors}>Adicionar usuário</SectionLabel>
      <form onSubmit={handleCreate}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field colors={colors} label="Usuário (login)">
            <input required value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} style={inputStyle(colors)} />
          </Field>
          <Field colors={colors} label="Nome de exibição">
            <input value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} style={inputStyle(colors)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field colors={colors} label="Senha">
            <input required type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={inputStyle(colors)} />
          </Field>
          <Field colors={colors} label="Tipo de acesso">
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} style={inputStyle(colors)}>
              <option value="user">Usuário (sem acesso a Configurações)</option>
              <option value="admin">Administrador</option>
            </select>
          </Field>
        </div>
        {error && <div style={{ color: colors.red, fontSize: 13, margin: '4px 0 10px' }}>{error}</div>}
        <button type="submit" disabled={creating} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Adicionando...' : 'Adicionar usuário'}
        </button>
      </form>
    </>
  );
}

function TwoFactorSection({ colors }) {
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('idle'); // idle | setup | recovery
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disableCode, setDisableCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.me().then(setMe).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function handleStartSetup() {
    setError('');
    setBusy(true);
    try {
      const { secret, otpauthUri } = await api.totpSetup();
      const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 168, margin: 1 });
      setSetupData({ secret, qrDataUrl });
      setStep('setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmEnable(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { recoveryCodes: codes } = await api.totpEnable(setupData.secret, code);
      setRecoveryCodes(codes);
      setStep('recovery');
      setCode('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFinishSetup() {
    setStep('idle');
    setSetupData(null);
    setRecoveryCodes(null);
  }

  async function handleDisable(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.totpDisable(disableCode);
      setDisableCode('');
      showToast('2FA desativado.', 'success');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionLabel colors={colors}>Autenticação em duas etapas (2FA)</SectionLabel>
      {!me && !error && <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14 }}>Carregando...</div>}

      {step === 'recovery' && recoveryCodes && (
        <div style={{ border: `1px solid ${colors.amber}`, background: `${colors.amber}14`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>2FA ativado! Guarde estes códigos de recuperação:</div>
          <div style={{ fontSize: 11.5, color: colors.textSecondary, marginBottom: 8 }}>
            Cada um funciona uma única vez, caso você perca o acesso ao app autenticador. Salve num lugar seguro — eles não aparecem de novo.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontFamily: 'monospace', fontSize: 12.5, color: colors.textPrimary, marginBottom: 10 }}>
            {recoveryCodes.map((c) => <div key={c}>{c}</div>)}
          </div>
          <button type="button" onClick={handleFinishSetup} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Já salvei, entendi
          </button>
        </div>
      )}

      {step === 'setup' && setupData && (
        <form onSubmit={handleConfirmEnable} style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
            <img src={setupData.qrDataUrl} alt="QR code" width={140} height={140} style={{ borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 6 }}>
                Escaneie com Google Authenticator, Authy ou similar. Não consegue escanear? Digite manualmente:
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, background: colors.bgCardAlt, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '5px 8px', wordBreak: 'break-all' }}>
                {setupData.secret}
              </div>
            </div>
          </div>
          <Field colors={colors} label="Código gerado pelo app, pra confirmar">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus style={{ ...inputStyle(colors), fontFamily: 'monospace', letterSpacing: '.08em' }} />
          </Field>
          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Confirmando...' : 'Ativar 2FA'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setSetupData(null); setError(''); }} style={{ border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 'idle' && me && (
        <>
          {me.totpEnabled ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, color: colors.green, fontWeight: 700 }}>
                <Icon paths={ICONS.shield} size={14} strokeWidth={2} /> 2FA ativado na sua conta
              </div>
              <form onSubmit={handleDisable} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <Field colors={colors} label="Código atual (pra desativar)">
                    <input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456" style={{ ...inputStyle(colors), fontFamily: 'monospace' }} />
                  </Field>
                </div>
                <button type="submit" disabled={busy || !disableCode} style={{ border: `1px solid ${colors.red}`, background: 'transparent', color: colors.red, borderRadius: 8, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (busy || !disableCode) ? 0.5 : 1, marginBottom: 14 }}>
                  Desativar 2FA
                </button>
              </form>
            </>
          ) : (
            <button type="button" onClick={handleStartSetup} disabled={busy} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              {busy ? 'Gerando...' : 'Ativar 2FA'}
            </button>
          )}
          {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        </>
      )}
    </>
  );
}

const AUDIT_PAGE_SIZE = 20;

function SecurityTab({ colors, form, setForm }) {
  const [auditLog, setAuditLog] = useState(null);
  const [auditError, setAuditError] = useState('');
  const [offset, setOffset] = useState(0);

  function loadAudit(newOffset) {
    api.auditLog({ limit: AUDIT_PAGE_SIZE, offset: newOffset })
      .then((res) => { setAuditLog(res); setOffset(newOffset); })
      .catch((err) => setAuditError(err.message));
  }
  useEffect(() => { loadAudit(0); }, []);

  return (
    <>
      <TwoFactorSection colors={colors} />

      <SectionLabel colors={colors}>Bloqueio de login por tentativas</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field colors={colors} label="Tentativas até bloquear">
          <input type="number" min={1} value={form.loginMaxAttempts} onChange={(e) => setForm({ ...form, loginMaxAttempts: e.target.value })} style={inputStyle(colors)} />
        </Field>
        <Field colors={colors} label="Janela (min)" hint="Falhas fora dessa janela não contam mais.">
          <input type="number" min={1} value={form.loginAttemptWindowMinutes} onChange={(e) => setForm({ ...form, loginAttemptWindowMinutes: e.target.value })} style={inputStyle(colors)} />
        </Field>
        <Field colors={colors} label="Bloqueio dura (min)">
          <input type="number" min={1} value={form.loginLockoutMinutes} onChange={(e) => setForm({ ...form, loginLockoutMinutes: e.target.value })} style={inputStyle(colors)} />
        </Field>
      </div>

      <SectionLabel colors={colors}>Log de auditoria</SectionLabel>
      {auditError && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{auditError}</div>}
      {!auditLog && !auditError && <div style={{ fontSize: 13, color: colors.textSecondary }}>Carregando...</div>}
      {auditLog && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', marginBottom: 10 }}>
            {auditLog.data.length === 0 && <div style={{ fontSize: 12.5, color: colors.textTertiary }}>Nenhum evento registrado ainda.</div>}
            {auditLog.data.map((entry) => (
              <div key={entry.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 9, padding: '7px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary }}>{entry.username}</span>
                  <span style={{ fontSize: 11, color: colors.textTertiary, whiteSpace: 'nowrap' }}>{new Date(entry.at).toLocaleString('pt-BR')}</span>
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{entry.details}</div>
              </div>
            ))}
          </div>
          {auditLog.total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: colors.textTertiary }}>{offset + 1}–{Math.min(offset + AUDIT_PAGE_SIZE, auditLog.total)} de {auditLog.total}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={offset === 0} onClick={() => loadAudit(Math.max(0, offset - AUDIT_PAGE_SIZE))} style={{ border: `1px solid ${colors.border}`, background: colors.bgCard, color: colors.textPrimary, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: offset === 0 ? 'default' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}>Anterior</button>
                <button type="button" disabled={offset + AUDIT_PAGE_SIZE >= auditLog.total} onClick={() => loadAudit(offset + AUDIT_PAGE_SIZE)} style={{ border: `1px solid ${colors.border}`, background: colors.bgCard, color: colors.textPrimary, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: (offset + AUDIT_PAGE_SIZE >= auditLog.total) ? 'default' : 'pointer', opacity: (offset + AUDIT_PAGE_SIZE >= auditLog.total) ? 0.5 : 1 }}>Próximo</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function BackupTab({ colors, form, setForm }) {
  const [backups, setBackups] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [busyName, setBusyName] = useState('');

  const load = () => api.backups().then((res) => setBackups(res.data)).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function handleRunBackup() {
    setRunning(true);
    setError('');
    try {
      await api.runBackup();
      showToast('Backup criado com sucesso.', 'success');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete(name) {
    if (!confirm(`Remover o backup "${name}"?`)) return;
    setBusyName(name);
    try {
      await api.deleteBackup(name);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyName('');
    }
  }

  async function handleRestore(name) {
    if (!confirm(`Restaurar o banco a partir de "${name}"? Isso substitui TODOS os dados atuais (dispositivos, usuários, histórico) pelos desse backup, e o painel vai reiniciar em seguida. Essa ação não pode ser desfeita.`)) return;
    setBusyName(name);
    try {
      const res = await api.restoreBackup(name);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
      setBusyName('');
    }
  }

  async function handleUploadRestore(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm(`Restaurar o banco a partir do arquivo "${file.name}"? Isso substitui TODOS os dados atuais pelos desse backup, e o painel vai reiniciar em seguida. Essa ação não pode ser desfeita.`)) return;
    try {
      const res = await api.restoreBackupUpload(file);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <>
      <SectionLabel colors={colors}>Backup automático</SectionLabel>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.textSecondary, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.backupEnabled} onChange={(e) => setForm({ ...form, backupEnabled: e.target.checked })} />
        Fazer backup do banco automaticamente, 1x por dia
      </label>
      <Field colors={colors} label="Manter backups por (dias)" hint="Backups mais antigos que isso são apagados automaticamente.">
        <input type="number" min={1} value={form.backupRetentionDays} onChange={(e) => setForm({ ...form, backupRetentionDays: e.target.value })} style={inputStyle(colors)} />
      </Field>

      <SectionLabel colors={colors}>Backups disponíveis</SectionLabel>
      {error && <div style={{ color: colors.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleRunBackup} disabled={running} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: running ? 'default' : 'pointer', opacity: running ? 0.7 : 1 }}>
          {running ? 'Gerando...' : 'Fazer backup agora'}
        </button>
        <label style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textPrimary, borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          Restaurar de um arquivo...
          <input type="file" accept=".gz" onChange={handleUploadRestore} style={{ display: 'none' }} />
        </label>
      </div>

      {!backups && !error && <div style={{ fontSize: 13, color: colors.textSecondary }}>Carregando...</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {backups?.length === 0 && <div style={{ fontSize: 12.5, color: colors.textTertiary }}>Nenhum backup ainda.</div>}
        {backups?.map((b) => (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${colors.border}`, borderRadius: 9, padding: '8px 12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.textPrimary }}>{new Date(b.createdAt).toLocaleString('pt-BR')}</div>
              <div style={{ fontSize: 11, color: colors.textTertiary }}>{formatBytes(b.sizeBytes)}</div>
            </div>
            <button type="button" onClick={() => api.downloadBackup(b.name)} title="Baixar" disabled={busyName === b.name} style={{ border: 'none', background: 'transparent', color: colors.textSecondary, cursor: 'pointer', display: 'flex', padding: 4 }}>
              <Icon paths={ICONS.download} size={15} strokeWidth={2} />
            </button>
            <button type="button" onClick={() => handleRestore(b.name)} title="Restaurar" disabled={busyName === b.name} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer', display: 'flex', padding: 4 }}>
              <Icon paths={ICONS.refresh} size={15} strokeWidth={2} />
            </button>
            <button type="button" onClick={() => handleDelete(b.name)} title="Remover" disabled={busyName === b.name} style={{ border: 'none', background: 'transparent', color: colors.red, cursor: 'pointer', display: 'flex', padding: 4 }}>
              <Icon paths={ICONS.trash} size={15} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function SettingsModal({ colors, settings, onClose, onSaved, currentUsername }) {
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({
    companyName: settings.companyName || '',
    siteName: settings.siteName || '',
    pingIntervalSeconds: settings.pingIntervalSeconds || '20',
    pingTimeoutMs: settings.pingTimeoutMs || '1200',
    offlineThresholdFails: settings.offlineThresholdFails || '2',
    alertReminderIntervalMinutes: settings.alertReminderIntervalMinutes || '60',
    networkBase: settings.networkBase || '192.168.1',
    networkHistoryRetentionHours: settings.networkHistoryRetentionHours || '168',
    telegramBotToken: settings.telegramBotToken || '',
    telegramChatId: settings.telegramChatId || '',
    executiveReportFrequency: settings.executiveReportFrequency || 'off',
    backupEnabled: settings.backupEnabled !== 'false',
    backupRetentionDays: settings.backupRetentionDays || '14',
    loginMaxAttempts: settings.loginMaxAttempts || '5',
    loginAttemptWindowMinutes: settings.loginAttemptWindowMinutes || '15',
    loginLockoutMinutes: settings.loginLockoutMinutes || '15',
    heartbeatEnabled: settings.heartbeatEnabled === 'true',
    heartbeatFrequencyHours: settings.heartbeatFrequencyHours || '24',
    logoFile: null,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateSettings(form);
      if (form.logoFile) await api.uploadLogo(form.logoFile);
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" style={{ width: '100%', maxWidth: 540, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '24px 26px', boxShadow: colors.shadow, overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', color: colors.textTertiary, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Icon paths={ICONS.settings} size={18} color={colors.textPrimary} strokeWidth={2} />
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: colors.textPrimary }}>Configurações</div>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, marginBottom: 16 }}>
          <TabButton colors={colors} active={tab === 'general'} onClick={() => setTab('general')}>Geral</TabButton>
          <TabButton colors={colors} active={tab === 'telegram'} onClick={() => setTab('telegram')}>Notificações</TabButton>
          <TabButton colors={colors} active={tab === 'users'} onClick={() => setTab('users')}>Usuários</TabButton>
          <TabButton colors={colors} active={tab === 'security'} onClick={() => setTab('security')}>Segurança</TabButton>
          <TabButton colors={colors} active={tab === 'backup'} onClick={() => setTab('backup')}>Backup</TabButton>
        </div>

        {tab === 'general' && <GeneralTab colors={colors} form={form} setForm={setForm} />}
        {tab === 'telegram' && <TelegramTab colors={colors} form={form} setForm={setForm} onTest={handleTestTelegram} testing={testing} />}
        {tab === 'users' && <UsersTab colors={colors} currentUsername={currentUsername} />}
        {tab === 'security' && <SecurityTab colors={colors} form={form} setForm={setForm} />}
        {tab === 'backup' && <BackupTab colors={colors} form={form} setForm={setForm} />}

        {currentUsername && tab !== 'users' && (
          <div style={{ fontSize: 12, color: colors.textTertiary, margin: '18px 0 4px' }}>Logado como <strong>{currentUsername}</strong></div>
        )}

        {tab !== 'users' && (
          <>
            {message && <div style={{ color: colors.green, fontSize: 13, margin: '12px 0' }}>{message}</div>}
            {error && <div style={{ color: colors.red, fontSize: 13, margin: '12px 0' }}>{error}</div>}
            <button onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: 14, padding: '11px 12px', borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
