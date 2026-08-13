// routes/admins.js
// Gerenciamento de administradores.
//
// Regra especial de "bootstrap": se ainda NÃO existe nenhum admin no banco,
// a rota de criação fica aberta (sem precisar de token) só para você criar
// o primeiro admin. Depois que já existe pelo menos 1 admin, criar novos
// admins passa a exigir estar logado como admin.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

function existeAlgumAdmin() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM admins').get();
  return total > 0;
}

// POST /api/admins
router.post('/', (req, res, next) => {
  // Se já existe algum admin, exige autenticação de admin antes de continuar.
  if (existeAlgumAdmin()) {
    return autenticar(req, res, () => somenteAdmin(req, res, () => criarAdmin(req, res)));
  }
  // Se não existe nenhum admin ainda, deixa passar livremente (bootstrap inicial).
  return criarAdmin(req, res);
});

function criarAdmin(req, res) {
  const { nome, telefone, senha } = req.body;

  if (!nome || !telefone || !senha) {
    return res.status(400).json({ erro: 'Informe nome, telefone e senha.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }

  const jaExiste = db.prepare('SELECT id FROM admins WHERE telefone = ?').get(telefone);
  if (jaExiste) {
    return res.status(409).json({ erro: 'Já existe um admin com esse telefone.' });
  }

  const senha_hash = bcrypt.hashSync(senha, 10);

  const resultado = db
    .prepare('INSERT INTO admins (nome, telefone, senha_hash) VALUES (?, ?, ?)')
    .run(nome, telefone, senha_hash);

  const novoAdmin = db
    .prepare('SELECT id, nome, telefone, criado_em FROM admins WHERE id = ?')
    .get(resultado.lastInsertRowid);

  res.status(201).json(novoAdmin);
}

// GET /api/admins  -> lista todos os admins (só admin pode ver)
router.get('/', autenticar, somenteAdmin, (req, res) => {
  const admins = db.prepare('SELECT id, nome, telefone, criado_em FROM admins').all();
  res.json(admins);
});

module.exports = router;
