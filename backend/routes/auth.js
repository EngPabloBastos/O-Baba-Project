// routes/auth.js
// Rotas de login. Tanto admin quanto associado logam com telefone + senha,
// mas em tabelas diferentes e recebem tokens com "role" diferente.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { gerarToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/admin/login
router.post('/admin/login', (req, res) => {
  const { telefone, senha } = req.body;

  if (!telefone || !senha) {
    return res.status(400).json({ erro: 'Informe telefone e senha.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE telefone = ?').get(telefone.trim());

  if (!admin || !bcrypt.compareSync(senha, admin.senha_hash)) {
    return res.status(401).json({ erro: 'Telefone ou senha incorretos.' });
  }

  const token = gerarToken({ id: admin.id, role: 'admin', nome: admin.nome });

  res.json({
    token,
    usuario: { id: admin.id, nome: admin.nome, telefone: admin.telefone, role: 'admin' },
  });
});

// POST /api/auth/associado/login
router.post('/associado/login', (req, res) => {
  const { telefone, senha } = req.body;

  if (!telefone || !senha) {
    return res.status(400).json({ erro: 'Informe telefone e senha.' });
  }

  const associado = db.prepare('SELECT * FROM associados WHERE telefone = ?').get(telefone.trim());

  if (!associado || !bcrypt.compareSync(senha, associado.senha_hash)) {
    return res.status(401).json({ erro: 'Telefone ou senha incorretos.' });
  }

  if (!associado.ativo) {
    return res.status(403).json({ erro: 'Este cadastro está desativado. Fale com um administrador.' });
  }

  const token = gerarToken({ id: associado.id, role: 'associado', nome: associado.nome });

  res.json({
    token,
    usuario: {
      id: associado.id,
      nome: associado.nome,
      apelido: associado.apelido,
      telefone: associado.telefone,
      role: 'associado',
    },
  });
});

module.exports = router;
