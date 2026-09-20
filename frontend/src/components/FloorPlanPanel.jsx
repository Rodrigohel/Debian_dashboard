import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon, { ICONS, TYPE_META } from './Icon.jsx';
import { api, resolveAssetUrl } from '../api/client.js';
import { showToast } from '../utils/toast.js';

const STATUS_COLOR = { online: 'green', offline: 'red', degraded: 'amber', unknown: 'gray' };

function floorStatus(devices, floorId) {
  const onFloor = devices.filter((d) => d.floorId === floorId && d.enabled);
  if (onFloor.length === 0) return 'gray';
  if (onFloor.some((d) => d.status === 'offline')) return 'red';
  if (onFloor.some((d) => d.status === 'degraded')) return 'amber';
  return 'green';
}

// Botão de um pavimento no painel tipo "elevador": nome, contagem e um
// pontinho que já mostra de longe se aquele andar tem algo errado — antes
// mesmo de clicar pra ver a planta.
function FloorButton({ colors, floor, count, statusColor, active, isAdmin, onSelect, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
        background: active ? `${colors.primary}16` : 'transparent',
        border: `1px solid ${active ? colors.primary : 'transparent'}`,
        position: 'relative',
      }}
      className="floor-btn"
    >
      <span style={{
        width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: colors[statusColor],
        animation: statusColor === 'red' ? 'pulseDot 1.4s ease-in-out infinite' : 'none',
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? colors.primary : colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {floor.name}
        </div>
        <div style={{ fontSize: 10.5, color: colors.textTertiary }}>{count} disp.</div>
      </div>
      {isAdmin && (
        <div className="floor-btn-arrows" style={{ display: 'flex', flexDirection: 'column', opacity: 0, transition: 'opacity .12s ease' }}>
          <button disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp(); }} style={{ border: 'none', background: 'transparent', color: colors.textTertiary, cursor: isFirst ? 'default' : 'pointer', opacity: isFirst ? 0.3 : 1, padding: 0, lineHeight: 0.7, display: 'flex', transform: 'rotate(180deg)' }}>
            <Icon paths={ICONS.chevronDown} size={11} strokeWidth={2.4} />
          </button>
          <button disabled={isLast} onClick={(e) => { e.stopPropagation(); onMoveDown(); }} style={{ border: 'none', background: 'transparent', color: colors.textTertiary, cursor: isLast ? 'default' : 'pointer', opacity: isLast ? 0.3 : 1, padding: 0, lineHeight: 0.7 }}>
            <Icon paths={ICONS.chevronDown} size={11} strokeWidth={2.4} />
          </button>
        </div>
      )}
      <style>{`.floor-btn:hover .floor-btn-arrows { opacity: 1; }`}</style>
    </div>
  );
}

function Pin({ colors, device, style, editable, dragging, onPointerDown, onRemove, onClick }) {
  const color = colors[STATUS_COLOR[device.status]] || colors.gray;
  const inMaintenance = device.maintenanceUntil && new Date(device.maintenanceUntil) > new Date();
  return (
    <div
      style={{ position: 'absolute', transform: 'translate(-50%,-50%)', zIndex: dragging ? 30 : 10, ...style }}
      onPointerDown={editable ? onPointerDown : undefined}
      onClick={editable ? undefined : onClick}
      className="floorplan-pin"
    >
      <div
        title={`${device.name} (${device.ip}) — ${device.status}`}
        style={{
          width: 18, height: 18, borderRadius: 99, background: color, border: '2.5px solid #fff',
          boxShadow: dragging ? '0 2px 10px rgba(0,0,0,.5)' : '0 1px 4px rgba(0,0,0,.35)',
          cursor: editable ? 'grab' : 'pointer',
          animation: device.status === 'offline' ? 'pulseDot 1.4s ease-in-out infinite' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          outline: editable ? `2px dashed ${colors.primary}55` : 'none', outlineOffset: 2,
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
        {editable && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ marginLeft: 6, border: 'none', background: 'transparent', color: colors.textTertiary, cursor: 'pointer', pointerEvents: 'auto', fontWeight: 700 }}>×</button>
        )}
      </div>
    </div>
  );
}

function AddFloorForm({ colors, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !file) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), file);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: `1px dashed ${colors.border}`, borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: 2º Andar)" style={{ padding: '6px 8px', borderRadius: 7, border: `1px solid ${colors.border}`, fontSize: 12 }} />
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 11 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" disabled={saving || !name.trim() || !file} style={{ flex: 1, border: 'none', background: colors.primary, color: '#fff', borderRadius: 7, padding: '6px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', opacity: (saving || !name.trim() || !file) ? 0.6 : 1 }}>
          {saving ? 'Enviando...' : 'Adicionar'}
        </button>
        <button type="button" onClick={onCancel} style={{ border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, borderRadius: 7, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Planta baixa interativa com suporte a múltiplos pavimentos (subsolo,
// térreo, garagens, andares...) — cada um com sua própria imagem e seus
// próprios pinos. O seletor à esquerda é tipo painel de elevador: já mostra
// de longe qual andar tem problema, sem precisar entrar em cada um.
export default function FloorPlanPanel({ colors, devices, isAdmin, onSelectDevice, onPositionChange }) {
  const [floors, setFloors] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [addingId, setAddingId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const editable = isAdmin && editMode;

  async function loadFloors(preferId) {
    const res = await api.floors();
    setFloors(res.data);
    if (preferId !== undefined) setSelectedId(preferId);
    else if (res.data.length > 0 && !res.data.some((f) => f.id === selectedId)) setSelectedId(res.data[0].id);
  }

  useEffect(() => { loadFloors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fullscreenOpen) return;
    function handleKey(e) { if (e.key === 'Escape') setFullscreenOpen(false); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreenOpen]);

  const selectedFloor = floors?.find((f) => f.id === selectedId) || null;
  const positioned = useMemo(() => devices.filter((d) => d.floorId === selectedId && d.floorX != null && d.floorY != null), [devices, selectedId]);
  const availableToAdd = useMemo(() => devices.filter((d) => d.floorId !== selectedId), [devices, selectedId]);

  function clientToRelative(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }

  // Distingue um clique parado (abre o detalhe, não mexe na posição) de um
  // arraste de verdade (só conta como arraste depois de mover mais que
  // DRAG_THRESHOLD px — sem isso, qualquer clique levemente impreciso em
  // cima do pino já disparava um "reposicionamento" de 1px, fazendo o pino
  // parecer que "sai do lugar sozinho" a cada clique).
  const DRAG_THRESHOLD = 4;

  function handlePointerDown(device, e) {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    function handleMove(ev) {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD) {
        moved = true;
        setDragging({ id: device.id, ...clientToRelative(startX, startY) });
      }
      if (moved) setDragging((d) => (d ? { ...d, ...clientToRelative(ev.clientX, ev.clientY) } : d));
    }
    function handleUp(ev) {
      if (moved) {
        const pos = clientToRelative(ev.clientX, ev.clientY);
        onPositionChange(device.id, selectedId, pos.x, pos.y);
      } else {
        onSelectDevice(device);
      }
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
    onPositionChange(id, selectedId, 0.5, 0.5);
    setAddingId('');
  }

  async function handleCreateFloor(name, file) {
    try {
      const floor = await api.createFloor(name, file);
      await loadFloors(floor.id);
      setShowAddForm(false);
      showToast(`Pavimento "${name}" criado.`, 'success');
    } catch (err) {
      showToast(`Erro ao criar pavimento: ${err.message}`, 'error');
    }
  }

  async function handleRename() {
    if (!renameValue.trim() || !selectedFloor) { setRenaming(false); return; }
    try {
      await api.renameFloor(selectedFloor.id, renameValue.trim());
      await loadFloors(selectedFloor.id);
    } catch (err) {
      showToast(`Erro ao renomear: ${err.message}`, 'error');
    } finally {
      setRenaming(false);
    }
  }

  async function handleReplaceImage(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedFloor) return;
    try {
      await api.updateFloorImage(selectedFloor.id, file);
      await loadFloors(selectedFloor.id);
      showToast('Imagem do pavimento atualizada.', 'success');
    } catch (err) {
      showToast(`Erro ao trocar imagem: ${err.message}`, 'error');
    }
  }

  async function handleDeleteFloor() {
    if (!selectedFloor) return;
    if (!confirm(`Excluir o pavimento "${selectedFloor.name}"? Os dispositivos nele deixam de aparecer em qualquer planta até serem reposicionados.`)) return;
    try {
      await api.deleteFloor(selectedFloor.id);
      await loadFloors();
    } catch (err) {
      showToast(`Erro ao excluir pavimento: ${err.message}`, 'error');
    }
  }

  async function handleMove(floor, dir) {
    const ids = floors.map((f) => f.id);
    const i = ids.indexOf(floor.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      const res = await api.reorderFloors(ids);
      setFloors(res.data);
    } catch (err) {
      showToast(`Erro ao reordenar: ${err.message}`, 'error');
    }
  }

  if (floors === null) return null;

  const floorSidebar = (
    <div style={{ width: 168, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 420, overflowY: 'auto' }}>
      {floors.map((floor, i) => (
        <FloorButton
          key={floor.id}
          colors={colors}
          floor={floor}
          count={devices.filter((d) => d.floorId === floor.id).length}
          statusColor={floorStatus(devices, floor.id)}
          active={floor.id === selectedId}
          isAdmin={isAdmin}
          onSelect={() => { setSelectedId(floor.id); setEditMode(false); }}
          onMoveUp={() => handleMove(floor, -1)}
          onMoveDown={() => handleMove(floor, 1)}
          isFirst={i === 0}
          isLast={i === floors.length - 1}
        />
      ))}
      {isAdmin && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px dashed ${colors.border}`, background: 'transparent', color: colors.textSecondary, borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
        >
          <Icon paths={ICONS.plus} size={12} strokeWidth={2.4} /> Pavimento
        </button>
      )}
      {isAdmin && showAddForm && (
        <div style={{ marginTop: 4 }}>
          <AddFloorForm colors={colors} onCancel={() => setShowAddForm(false)} onCreate={handleCreateFloor} />
        </div>
      )}
    </div>
  );

  // Conteúdo do pavimento selecionado (título, controles de admin, imagem
  // com os pinos) — usado tanto inline (desktop) quanto dentro do overlay
  // de tela cheia, sempre com o mesmo `containerRef`/pinos (nunca os dois
  // ao mesmo tempo), pra não duplicar a lógica de arraste.
  const stage = selectedFloor && (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            style={{ fontSize: 14, fontWeight: 700, padding: '4px 8px', borderRadius: 7, border: `1px solid ${colors.primary}` }}
          />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{selectedFloor.name}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isAdmin && !renaming && (
            <>
              <button onClick={() => { setRenaming(true); setRenameValue(selectedFloor.name); }} title="Renomear" style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
                <Icon paths={ICONS.pencil} size={12} strokeWidth={2.2} color={colors.textSecondary} />
              </button>
              <label title="Trocar imagem" style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
                <Icon paths={ICONS.upload} size={12} strokeWidth={2.2} color={colors.textSecondary} />
                <input type="file" accept="image/*" onChange={handleReplaceImage} style={{ display: 'none' }} />
              </label>
              <button onClick={handleDeleteFloor} title="Excluir pavimento" style={{ border: `1px solid ${colors.redSoft}`, background: colors.bgCardAlt, borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
                <Icon paths={ICONS.trash} size={12} strokeWidth={2.2} color={colors.red} />
              </button>
              <button
                onClick={() => setEditMode((v) => !v)}
                title={editMode ? 'Concluir edição' : 'Editar posições dos pinos'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${editMode ? colors.primary : colors.border}`,
                  background: editMode ? colors.primary : colors.bgCardAlt, color: editMode ? '#fff' : colors.textSecondary,
                  borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Icon paths={editMode ? ICONS.check : ICONS.wrench} size={12} strokeWidth={2.4} />
                {editMode ? 'Concluir edição' : 'Editar posições'}
              </button>
              {editMode && availableToAdd.length > 0 && (
                <select
                  value={addingId}
                  onChange={handleAddDevice}
                  style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, color: colors.textSecondary, borderRadius: 8, padding: '6px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  <option value="">+ Posicionar dispositivo...</option>
                  {availableToAdd.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
                </select>
              )}
            </>
          )}
          {!fullscreenOpen ? (
            <button onClick={() => setFullscreenOpen(true)} title="Ver em tela cheia" style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
              <Icon paths={ICONS.expand} size={12} strokeWidth={2.2} color={colors.textSecondary} />
            </button>
          ) : (
            <button onClick={() => setFullscreenOpen(false)} title="Fechar" style={{ border: `1px solid ${colors.border}`, background: colors.bgCardAlt, borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
              <Icon paths={ICONS.close} size={12} strokeWidth={2.2} color={colors.textSecondary} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', touchAction: 'none',
          border: `1px solid ${editable ? colors.primary : colors.border}`, background: colors.bgCardAlt,
          boxShadow: editable ? `0 0 0 3px ${colors.primary}22` : 'none',
        }}
      >
        <img src={resolveAssetUrl(selectedFloor.imageUrl)} alt={selectedFloor.name} style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' }} draggable={false} />
        {positioned.map((d) => {
          const isDragging = dragging?.id === d.id;
          const x = isDragging ? dragging.x : d.floorX;
          const y = isDragging ? dragging.y : d.floorY;
          return (
            <Pin
              key={d.id}
              colors={colors}
              device={d}
              editable={editable}
              dragging={isDragging}
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              onPointerDown={(e) => handlePointerDown(d, e)}
              onRemove={() => onPositionChange(d.id, null, null, null)}
              onClick={() => onSelectDevice(d)}
            />
          );
        })}
      </div>

      {isAdmin && (
        <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8 }}>
          {editMode
            ? 'Modo de edição: arraste um pino pra reposicionar, clique no × pra remover do pavimento, ou use "Posicionar dispositivo" pra adicionar/mover um.'
            : 'Clique num pino pra ver o dispositivo. Toque em "Editar posições" para poder arrastar.'}
        </div>
      )}
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Icon paths={ICONS.map} size={15} strokeWidth={2.2} color={colors.textSecondary} />
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Planta baixa</div>
    </div>
  );

  const body = (
    <>
      {floors.length === 0 && !showAddForm && (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <Icon paths={ICONS.map} size={24} strokeWidth={1.6} color={colors.textTertiary} />
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginTop: 8 }}>Nenhum pavimento cadastrado</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, marginBottom: 12 }}>
            {isAdmin ? 'Adicione o primeiro pavimento (ex.: Térreo) com a imagem da planta baixa.' : 'Peça a um administrador para configurar os pavimentos.'}
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddForm(true)} style={{ border: 'none', background: colors.primary, color: '#fff', borderRadius: 9, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              + Adicionar pavimento
            </button>
          )}
        </div>
      )}

      {(floors.length > 0 || showAddForm) && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {floorSidebar}

          {fullscreenOpen ? stage : (
            <>
              {/* Desktop: imagem inline. Some no celular (media query em
                  index.html) — lá vira a linha compacta "Ver planta" abaixo. */}
              <div className="floorplan-desktop-stage" style={{ display: 'contents' }}>{stage}</div>
              {selectedFloor && (
                <div
                  className="floorplan-mobile-compact"
                  onClick={() => setFullscreenOpen(true)}
                  style={{
                    alignItems: 'center', gap: 10, flex: 1, minWidth: 220, cursor: 'pointer',
                    border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 12px', background: colors.bgCardAlt,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: colors[floorStatus(devices, selectedFloor.id)] }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFloor.name}</div>
                    <div style={{ fontSize: 10.5, color: colors.textTertiary }}>{positioned.length} disp.</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: colors.primary, whiteSpace: 'nowrap' }}>
                    Ver planta <Icon paths={ICONS.chevronRight} size={12} strokeWidth={2.4} />
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );

  if (fullscreenOpen) {
    // Via portal, direto em document.body: se renderizasse no lugar normal,
    // ficaria "preso" dentro do card da seção (que tem uma animação de
    // entrada com transform — isso cria um novo containing block pra
    // position:fixed, fazendo o "tela cheia" cobrir só o card em vez da
    // tela toda).
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: colors.pageGradient, padding: '16px 16px 32px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: colors.shadow }}>
          {header}
          {body}
        </div>
        <style>{`.floorplan-pin:hover .floorplan-pin-label { opacity: 1; }`}</style>
      </div>,
      document.body,
    );
  }

  return (
    <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: colors.shadow }}>
      {header}
      {body}
      <style>{`.floorplan-pin:hover .floorplan-pin-label { opacity: 1; }`}</style>
    </div>
  );
}
