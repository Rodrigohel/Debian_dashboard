export default function TopBar({ colors, monitoring }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: colors.textTertiary, letterSpacing: '.02em' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: monitoring ? colors.green : colors.amber }} />
      {monitoring ? 'Monitoramento ativo — verificando os dispositivos em tempo real' : 'Aguardando primeira verificação...'}
    </div>
  );
}
