import { useEffect, useState } from 'react';
import { subscribeToast } from '../utils/toast.js';
import Icon, { ICONS } from './Icon.jsx';

const TYPE_META = {
  success: { color: 'green', icon: ICONS.check },
  error: { color: 'red', icon: ICONS.offline },
  info: { color: 'primary', icon: ICONS.info },
};

export default function ToastContainer({ colors }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribeToast((toast) => {
    setToasts((current) => [...current, toast]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== toast.id)), 6000);
  }), []);

  function dismiss(id) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380 }}>
      {toasts.map((toast) => {
        const meta = TYPE_META[toast.type] || TYPE_META.info;
        return (
          <div
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, background: colors.bgCard, border: `1px solid ${colors.border}`,
              borderLeft: `3px solid ${colors[meta.color]}`, borderRadius: 12, padding: '12px 14px', boxShadow: colors.shadowHover,
              cursor: 'pointer', animation: 'fadeInUp .25s ease both',
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 99, background: `${colors[meta.color]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Icon paths={meta.icon} size={12} strokeWidth={2.4} color={colors[meta.color]} />
            </div>
            <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{toast.message}</div>
          </div>
        );
      })}
    </div>
  );
}
