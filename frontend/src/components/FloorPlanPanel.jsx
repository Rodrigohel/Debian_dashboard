import { useMemo, useRef, useState } from 'react';
import Icon, { ICONS, TYPE_META } from './Icon.jsx';
import { resolveAssetUrl } from '../api/client.js';

const STATUS_COLOR = { online: 'green', offline: 'red', degraded: 'amber', unknown: 'gray' };

function Pin({ colors, device, style, isAdmin, dragging, onPointerDown, onRemove, onClick }) {
  const color = colors[STATUS_COLOR[device.status]] || colors.gray;
  const inMaintenance = device.maintenanceUntil && new Date(device.maintenanceUntil) > new Date();
  return (
    <div
      style={{ position: 'absolute', transform: 'translate(-50%,-50%)', zIndex: dragging ? 30 : 10, ...style }}
      onPointerDown={isAdmin ? onPointerDown : undefined}
      className="floorplan-pin"
    >
      <div
        onClick={onClick}
        title={`${device.name} (${device.ip}) — ${device.status}`}
        style={{
          width: 18, height: 18, borderRadius: 99, background: color, border: '2.5px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,.35)', cursor: isAdmin ? 'grab' : 'pointer',
          animation: device.status === 'offline' ? 'pulseDot 1.4s ease-in-out infinite' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {inMaintenance && <Icon paths={ICONS.wrench} size={9} strokeWidth={3} color="#fff" />}
      </div>
      <div className="floorplan-pin-label" style={{
        position: 'absolute', top: '120%', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
        background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '3px 8px',
        fontSize: 11, fontWeight: 700, color: colors.textPrimary, boxShadow: colors.shadow, pointerEvents: 'none',
        opacity: 0, transition: 'opacity .12s ease',
      }}>
        {device.name}
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ marginLeft: 6, border: 'none', background: 'transparent', color: colors.textTertiary, cursor: 'pointer', pointerEvents: 'auto', fontWeight: 700 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// Planta baixa interativa: sobe uma imagem do prédio/condomínio (Config.) e
// posiciona cada dispositivo nela arrastando o pino — muito mais intuitivo
// que uma tabela pra localizar fisicamente ~230 pontos espalhados, e o pino
// já muda de cor sozinho com o status ao vivo.
export default function FloorPlanPanel({ colors, devices, floorPlanUrl, isAdmin, onSelectDevice, onPositionChange }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, x, y }
  const [addingId, setAddingId] = useState('');

  const positioned = useMemo(() => devices.filter((d) => d.floorX != null && d.floorY != null), [devices]);
  const unplaced = useMemo(() => devices.filter((d) => d.floorX == null || d.floorY == null), [devices]);

  function clientToRelative(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handlePointerDown(device, e) {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    setDragging({ id: device.id, ...clientToRelative(e.clientX, e.clientY) });

    function handleMove(ev) {
      setDragging((d) => (d ? { ...d, ...clientToRelative(ev.clientX, ev.clientY) } : d));
    }
    function handleUp(ev) {
      const pos = clientToRelative(ev.clientX, ev.clientY);
      onPositionChange(device.id, pos.x, pos.y);
      setDragging(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  function handleAddDevice(e) {
    const id = Number(e.target.value);
    if (!id) return;
    onPositionChange(id, 0.5, 0.5);
    setAddingId('');
  }

  if (!floorPlanUrl) {
    return (
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '28px 22px', boxShadow: colors.shadow, textAlign: 'center' }}>
        <Icon paths={ICONS.map} size={26} strokeWidth={1.6} color={colors.textTertiary} />
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary, marginTop: 10 }}>Nenhuma planta baixa configurada</div>
        <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>
          Envie a imagem do prédio/condomínio em Configurações → aba Geral pra posicionar cada dispositivo visualmente.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: colors.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon paths={ICONS.map} size={15} strokeWidth={2.2} color={colors.textSecondary} />
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Planta baixa</div>
        </div>
        {isAdmin && unplaced.length > 0 && (
          <select
            value={addingId}
            onChange={handleAddDevice}
            style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textSecondary, borderRadius: 9, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <option value="">+ Posicionar dispositivo...</option>
            {unplaced.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
          </select>
        )}
      </div>

      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', border: `1px solid ${colors.border}`, background: colors.bgCardAlt, touchAction: 'none' }}
      >
        <img src={resolveAssetUrl(floorPlanUrl)} alt="Planta baixa" style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' }} draggable={false} />
        {positioned.map((d) => {
          const isDragging = dragging?.id === d.id;
          const x = isDragging ? dragging.x : d.floorX;
          const y = isDragging ? dragging.y : d.floorY;
          return (
            <Pin
              key={d.id}
              colors={colors}
              device={d}
              isAdmin={isAdmin}
              dragging={isDragging}
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              onPointerDown={(e) => handlePointerDown(d, e)}
              onRemove={() => onPositionChange(d.id, null, null)}
              onClick={() => !isDragging && onSelectDevice(d)}
            />
          );
        })}
      </div>

      {isAdmin && (
        <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 10 }}>
          Arraste um pino pra reposicionar, clique no × pra remover da planta, ou use "Posicionar dispositivo" pra adicionar um novo.
        </div>
      )}

      <style>{`.floorplan-pin:hover .floorplan-pin-label { opacity: 1; }`}</style>
    </div>
  );
}
