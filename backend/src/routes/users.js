import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/sqlite.js';

export const usersRouter = Router();

const listStmt = db.prepare('SELECT id, username, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY created_at');
const insertStmt = db.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)');
const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM users');

usersRouter.get('/', (req, res) => {
  res.json(listStmt.all());
});

usersRouter.post('/', (req, res) => {
  const { username, displayName, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = insertStmt.run(username.trim(), (displayName || username).trim(), hash, role === 'admin' ? 'admin' : 'user');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

usersRouter.delete('/:id', (req, res) => {
  if (countStmt.get().n <= 1) {
    return res.status(400).json({ error: 'Não é possível remover o único usuário do painel.' });
  }
  deleteStmt.run(req.params.id);
  res.status(204).end();
});
