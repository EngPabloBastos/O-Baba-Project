// routes/associados.js
// Cadastro e gerenciamento de associados. Só admins podem criar/editar/desativar/
// alterar status de pagamento. Associados logados podem ver a própria ficha e a
// lista de outros (dados públicos), mas nunca alterar nada.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

// Campos "públicos" que qualquer pessoa logada (admin ou associado) pode ver.
// Nunca devolvemos senha_hash em nenhuma rota.
const CAMPOS_PUBLICOS = 'id, nome, apelido, telefone, status_pagamento, ativo, criado_em';

// Sempre que a lista de associados é acessada, garante que o reset mensal
// automático de status_pagamento já foi aplicado (cobre o caso do servidor
// ter ficado desligado durante a virada do mês).
router.use((req, res, next) => {
  db.garantirStatusPagamentoAtualizado();
  next();
});

// POST /api/associados  -> criar novo associado (somente admin)
router.post('/', autenticar, somenteAdmin, (req, res) => {
  const { nome, apelido, telefone, senha } = req.body;

  if (!nome || !telefone || !senha) {
    return res.status(400).json({ erro: 'Informe nome, telefone e senha.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }

  const telefoneLimpo = telefone.trim();

  const jaExiste = db.prepare('SELECT id FROM associados WHERE telefone = ?').get(telefoneLimpo);
  if (jaExiste) {
    return res.status(409).json({ erro: 'Já existe um associado com esse telefone.' });
  }

  const senha_hash = bcrypt.hashSync(senha, 10);

  const resultado = db
    .prepare(
      `INSERT INTO associados (nome, apelido, telefone, senha_hash, criado_por_admin_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(nome, apelido || null, telefoneLimpo, senha_hash, req.user.id);

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

// PATCH /api/associados/me/senha  -> o próprio associado troca a própria senha
// body: { senha_atual, senha_nova }. Exige a senha atual por segurança.
router.patch('/me/senha', autenticar, (req, res) => {
  if (req.user.role !== 'associado') {
    return res.status(403).json({ erro: 'Rota disponível apenas para associados.' });
  }

  const { senha_atual, senha_nova } = req.body;
  if (!senha_atual || !senha_nova) {
    return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
  }
  if (senha_nova.length < 6) {
    return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  }

  const associado = db.prepare('SELECT * FROM associados WHERE id = ?').get(req.user.id);
  if (!associado || !bcrypt.compareSync(senha_atual, associado.senha_hash)) {
    return res.status(401).json({ erro: 'Senha atual incorreta.' });
  }

  const novaSenhaHash = bcrypt.hashSync(senha_nova, 10);
  db.prepare('UPDATE associados SET senha_hash = ? WHERE id = ?').run(novaSenhaHash, req.user.id);

  res.json({ mensagem: 'Senha alterada com sucesso.' });
});

// PUT /api/associados/:id  -> editar dados (somente admin)
// Não altera status_pagamento aqui de propósito: isso tem rota própria (PATCH /:id/pagamento)
// para deixar claro no histórico/permissões que é uma ação distinta.
router.put('/:id', autenticar, somenteAdmin, (req, res) => {
  const associado = db.prepare('SELECT * FROM associados WHERE id = ?').get(req.params.id);
  if (!associado) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }

  const { nome, apelido, telefone, senha } = req.body;

  const novoNome = nome ?? associado.nome;
  const novoApelido = apelido ?? associado.apelido;
  const novoTelefone = telefone ? telefone.trim() : associado.telefone;
  const novaSenhaHash = senha ? bcrypt.hashSync(senha, 10) : associado.senha_hash;

  db.prepare(
    `UPDATE associados SET nome = ?, apelido = ?, telefone = ?, senha_hash = ?
     WHERE id = ?`
  ).run(novoNome, novoApelido, novoTelefone, novaSenhaHash, req.params.id);

  const atualizado = db
    .prepare(`SELECT ${CAMPOS_PUBLICOS} FROM associados WHERE id = ?`)
    .get(req.params.id);

  res.json(atualizado);
});

// PATCH /api/associados/:id/pagamento  -> altera status de pagamento (somente admin)
// body: { status: 'pago' | 'nao_pago' }
router.patch('/:id/pagamento', autenticar, somenteAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pago', 'nao_pago'].includes(status)) {
    return res.status(400).json({ erro: "status deve ser 'pago' ou 'nao_pago'." });
  }

  const resultado = db
    .prepare('UPDATE associados SET status_pagamento = ? WHERE id = ?')
    .run(status, req.params.id);

  if (resultado.changes === 0) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }

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
