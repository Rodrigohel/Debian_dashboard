import { db } from '../db/sqlite.js';

const listStmt = db.prepare('SELECT id, name, image_url AS imageUrl, sort_order AS sortOrder FROM floors ORDER BY sort_order, id');
const getStmt = db.prepare('SELECT id, name, image_url AS imageUrl, sort_order AS sortOrder FROM floors WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO floors (name, image_url, sort_order) VALUES (@name, @imageUrl, @sortOrder)');
const renameStmt = db.prepare('UPDATE floors SET name = @name WHERE id = @id');
const updateImageStmt = db.prepare('UPDATE floors SET image_url = @imageUrl WHERE id = @id');
const deleteStmt = db.prepare('DELETE FROM floors WHERE id = ?');
const clearDevicePositionsStmt = db.prepare('UPDATE devices SET floor_id = NULL, floor_x = NULL, floor_y = NULL WHERE floor_id = ?');
const maxOrderStmt = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM floors');
const setOrderStmt = db.prepare('UPDATE floors SET sort_order = ? WHERE id = ?');

export function listFloors() {
  return listStmt.all();
}

export function getFloor(id) {
  return getStmt.get(id);
}

export function createFloor({ name, imageUrl }) {
  const sortOrder = maxOrderStmt.get().m + 1;
  const info = insertStmt.run({ name, imageUrl, sortOrder });
  return getFloor(info.lastInsertRowid);
}

export function renameFloor(id, name) {
  renameStmt.run({ id, name });
  return getFloor(id);
}

export function updateFloorImage(id, imageUrl) {
  updateImageStmt.run({ id, imageUrl });
  return getFloor(id);
}

// Remove o pavimento e "solta" quem estava posicionado nele — os
// dispositivos continuam existindo e sendo monitorados normalmente, só
// deixam de aparecer em qualquer planta baixa até serem reposicionados.
export function deleteFloor(id) {
  clearDevicePositionsStmt.run(id);
  deleteStmt.run(id);
}

export const reorderFloorsTx = db.transaction((orderedIds) => {
  orderedIds.forEach((id, i) => setOrderStmt.run(i, id));
});

export function reorderFloors(orderedIds) {
  reorderFloorsTx(orderedIds);
  return listFloors();
}
