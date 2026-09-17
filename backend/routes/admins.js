// routes/admins.js
// Gerenciamento de administradores.
// Se ainda não existe nenhum admin, a criação fica aberta (bootstrap).

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
  if (existeAlgumAdmin()) {
    return autenticar(req, res, () => somenteAdmin(req, res, () => criarAdmin(req, res)));
  }
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

  // remove espaço acidental de copiar/colar
  const telefoneLimpo = telefone.trim();

  const jaExiste = db.prepare('SELECT id FROM admins WHERE telefone = ?').get(telefoneLimpo);
  if (jaExiste) {
    return res.status(409).json({ erro: 'Já existe um admin com esse telefone.' });
  }

  const senha_hash = bcrypt.hashSync(senha, 10);

  const resultado = db
    .prepare('INSERT INTO admins (nome, telefone, senha_hash) VALUES (?, ?, ?)')
    .run(nome, telefoneLimpo, senha_hash);

  const novoAdmin = db
    .prepare('SELECT id, nome, telefone, criado_em FROM admins WHERE id = ?')
    .get(resultado.lastInsertRowid);

  res.status(201).json(novoAdmin);
}

// GET /api/admins
router.get('/', autenticar, somenteAdmin, (req, res) => {
  const admins = db.prepare('SELECT id, nome, telefone, criado_em FROM admins ORDER BY id').all();
  res.json(admins);
});

// DELETE /api/admins/:id  -> exige a frase de confirmação; nunca apaga o primeiro admin
router.delete('/:id', autenticar, somenteAdmin, (req, res) => {
  const { senha_confirmacao } = req.body;
  if (senha_confirmacao !== 'ragnarock') {
    return res.status(401).json({ erro: 'Senha de confirmação incorreta.' });
  }

  const primeiroAdmin = db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get();
  if (primeiroAdmin && Number(req.params.id) === primeiroAdmin.id) {
    return res.status(403).json({ erro: 'O primeiro admin criado não pode ser excluído.' });
  }

  const resultado = db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  if (resultado.changes === 0) {
    return res.status(404).json({ erro: 'Admin não encontrado.' });
  }

  res.json({ mensagem: 'Admin excluído com sucesso.' });
});

module.exports = router;
