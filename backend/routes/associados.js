// routes/associados.js
// Cadastro e gerenciamento de associados. Só admins podem criar/editar/desativar.
// Associados logados podem ver a própria ficha e a lista de outros (dados públicos).

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

// Campos "públicos" que qualquer pessoa logada (admin ou associado) pode ver.
// Nunca devolvemos senha_hash em nenhuma rota.
const CAMPOS_PUBLICOS = 'id, nome, apelido, telefone, posicao, nivel, ativo, criado_em';

// POST /api/associados  -> criar novo associado (somente admin)
router.post('/', autenticar, somenteAdmin, (req, res) => {
  const { nome, apelido, telefone, senha, posicao, nivel } = req.body;

  if (!nome || !telefone || !senha) {
    return res.status(400).json({ erro: 'Informe nome, telefone e senha.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }
  const posicaoValida = ['linha', 'goleiro', 'ambos'];
  const posicaoFinal = posicao && posicaoValida.includes(posicao) ? posicao : 'linha';

  const jaExiste = db.prepare('SELECT id FROM associados WHERE telefone = ?').get(telefone);
  if (jaExiste) {
    return res.status(409).json({ erro: 'Já existe um associado com esse telefone.' });
  }

  const senha_hash = bcrypt.hashSync(senha, 10);

  const resultado = db
    .prepare(
      `INSERT INTO associados (nome, apelido, telefone, senha_hash, posicao, nivel, criado_por_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(nome, apelido || null, telefone, senha_hash, posicaoFinal, nivel || null, req.user.id);

  const novoAssociado = db
    .prepare(`SELECT ${CAMPOS_PUBLICOS} FROM associados WHERE id = ?`)
    .get(resultado.lastInsertRowid);

  res.status(201).json(novoAssociado);
});

// GET /api/associados  -> lista todos (admin ou associado logado)
// suporta ?ativo=1 ou ?ativo=0 para filtrar
router.get('/', autenticar, (req, res) => {
  let sql = `SELECT ${CAMPOS_PUBLICOS} FROM associados`;
  const params = [];

  if (req.query.ativo === '0' || req.query.ativo === '1') {
    sql += ' WHERE ativo = ?';
    params.push(Number(req.query.ativo));
  }
  sql += ' ORDER BY nome';

  const associados = db.prepare(sql).all(...params);
  res.json(associados);
});

// GET /api/associados/me  -> ficha do próprio associado logado
router.get('/me', autenticar, (req, res) => {
  if (req.user.role !== 'associado') {
    return res.status(403).json({ erro: 'Rota disponível apenas para associados.' });
  }
  const associado = db
    .prepare(`SELECT ${CAMPOS_PUBLICOS} FROM associados WHERE id = ?`)
    .get(req.user.id);
  res.json(associado);
});

// GET /api/associados/:id  -> ficha de um associado específico
router.get('/:id', autenticar, (req, res) => {
  const associado = db
    .prepare(`SELECT ${CAMPOS_PUBLICOS} FROM associados WHERE id = ?`)
    .get(req.params.id);

  if (!associado) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }
  res.json(associado);
});

// PUT /api/associados/:id  -> editar dados (somente admin)
router.put('/:id', autenticar, somenteAdmin, (req, res) => {
  const associado = db.prepare('SELECT * FROM associados WHERE id = ?').get(req.params.id);
  if (!associado) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }

  const { nome, apelido, telefone, posicao, nivel, senha } = req.body;

  const novoNome = nome ?? associado.nome;
  const novoApelido = apelido ?? associado.apelido;
  const novoTelefone = telefone ?? associado.telefone;
  const novaPosicao = posicao ?? associado.posicao;
  const novoNivel = nivel ?? associado.nivel;
  const novaSenhaHash = senha ? bcrypt.hashSync(senha, 10) : associado.senha_hash;

  db.prepare(
    `UPDATE associados SET nome = ?, apelido = ?, telefone = ?, posicao = ?, nivel = ?, senha_hash = ?
     WHERE id = ?`
  ).run(novoNome, novoApelido, novoTelefone, novaPosicao, novoNivel, novaSenhaHash, req.params.id);

  const atualizado = db
    .prepare(`SELECT ${CAMPOS_PUBLICOS} FROM associados WHERE id = ?`)
    .get(req.params.id);

  res.json(atualizado);
});

// PATCH /api/associados/:id/desativar  -> desativa sem apagar (mantém histórico de gols/partidas)
router.patch('/:id/desativar', autenticar, somenteAdmin, (req, res) => {
  const resultado = db.prepare('UPDATE associados SET ativo = 0 WHERE id = ?').run(req.params.id);
  if (resultado.changes === 0) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }
  res.json({ mensagem: 'Associado desativado.' });
});

// PATCH /api/associados/:id/reativar
router.patch('/:id/reativar', autenticar, somenteAdmin, (req, res) => {
  const resultado = db.prepare('UPDATE associados SET ativo = 1 WHERE id = ?').run(req.params.id);
  if (resultado.changes === 0) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }
  res.json({ mensagem: 'Associado reativado.' });
});

// DELETE /api/associados/:id  -> apaga de vez (use com cuidado; prefira "desativar")
router.delete('/:id', autenticar, somenteAdmin, (req, res) => {
  const resultado = db.prepare('DELETE FROM associados WHERE id = ?').run(req.params.id);
  if (resultado.changes === 0) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }
  res.json({ mensagem: 'Associado removido definitivamente.' });
});

module.exports = router;
