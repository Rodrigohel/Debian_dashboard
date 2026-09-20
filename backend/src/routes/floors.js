import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { requireAdmin } from '../middleware/auth.js';
import { listFloors, createFloor, renameFloor, updateFloorImage, deleteFloor, reorderFloors } from '../services/floorsService.js';

export const floorsRouter = Router();

const uploadsDir = path.resolve('data/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `floor-${Date.now()}${path.extname(file.originalname).toLowerCase() || '.png'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Envie um arquivo de imagem (PNG, JPG ou SVG).'));
      return;
    }
    cb(null, true);
  },
});

// Leitura liberada pra qualquer usuário logado (não só admin) — todo mundo
// pode CONSULTAR a planta baixa de cada pavimento; só criar/editar/excluir
// pavimento e reposicionar dispositivo exige admin (ver rotas abaixo e
// devicesRouter).
floorsRouter.get('/', (req, res) => {
  res.json({ data: listFloors() });
});

floorsRouter.post('/', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome do pavimento é obrigatório.' });
    if (!req.file) return res.status(400).json({ error: 'Envie a imagem da planta baixa.' });
    res.status(201).json(createFloor({ name, imageUrl: `/api/uploads/${req.file.filename}` }));
  });
});

floorsRouter.put('/:id', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome do pavimento é obrigatório.' });
  res.json(renameFloor(Number(req.params.id), name));
});

floorsRouter.post('/:id/image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem.' });
    res.json(updateFloorImage(Number(req.params.id), `/api/uploads/${req.file.filename}`));
  });
});

floorsRouter.delete('/:id', requireAdmin, (req, res) => {
  deleteFloor(Number(req.params.id));
  res.status(204).end();
});

// `ids`: lista completa dos ids de pavimento na nova ordem (de cima pra
// baixo, tipo painel de elevador) — grava o índice de cada um como
// sort_order numa transação só.
floorsRouter.post('/reorder', requireAdmin, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  res.json({ data: reorderFloors(ids) });
});
