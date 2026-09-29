// routes/premiacoes.js
// Hall da Fama: consulta aberta a qualquer usuário logado; fechar período, lançar
// premiados por voto e remover são só para admin (lançar e remover pedem a senha
// de confirmação, no mesmo padrão da exclusão de Dia de Baba).

const express = require('express');
const db = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const {
  TIPOS,
  TIPOS_POR_VOTO,
  fecharPeriodo,
  listarPeriodos,
  buscarPremiacoes,
  conquistasDoJogador,
} = require('../lib/premiacoes');

const router = express.Router();

const SENHA_CONFIRMACAO = 'adm.ragnarock';

// Lê e valida { periodo, ano, mes } de uma query string ou body. mes vira 0 nas anuais.
function lerPeriodo(origem) {
  const periodo = origem.periodo;
  const ano = Number(origem.ano);
  if (periodo !== 'mensal' && periodo !== 'anual') return { erro: 'Período inválido.' };
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { erro: 'Ano inválido.' };
  if (periodo === 'anual') return { periodo, ano, mes: 0 };
  const mes = Number(origem.mes);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return { erro: 'Mês inválido.' };
  return { periodo, ano, mes };
}

function senhaCorreta(req) {
  return req.body && req.body.senha_confirmacao === SENHA_CONFIRMACAO;
}

// GET /api/premiacoes/periodos -> { mensais: [{ano, mes}], anuais: [ano] }
router.get('/periodos', autenticar, (req, res) => {
  res.json(listarPeriodos());
});

// GET /api/premiacoes/jogador/:id -> conquistas de um jogador
router.get('/jogador/:id', autenticar, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Associado inválido.' });
  res.json(conquistasDoJogador(id));
});

// GET /api/premiacoes?periodo=mensal|anual&ano=2026&mes=3
router.get('/', autenticar, (req, res) => {
  const p = lerPeriodo(req.query);
  if (p.erro) return res.status(400).json({ erro: p.erro });
  res.json({ ...p, premios: buscarPremiacoes(p) });
});

// POST /api/premiacoes/fechar { periodo, ano, mes }
// Calcula e grava as 3 premiações automáticas. Pode ser repetido: recalcula só as
// automáticas do período, sem mexer nas lançadas por voto.
router.post('/fechar', autenticar, somenteAdmin, (req, res) => {
  const p = lerPeriodo(req.body || {});
  if (p.erro) return res.status(400).json({ erro: p.erro });

  const resultado = fecharPeriodo(p, req.user.id);
  if (!resultado) {
    return res.status(400).json({ erro: 'Não há partidas encerradas nesse período.' });
  }
  res.json({ mensagem: 'Período fechado.', ...resultado, premios: buscarPremiacoes(p) });
});

// POST /api/premiacoes/voto { tipo, periodo, ano, mes, associado_id, senha_confirmacao }
router.post('/voto', autenticar, somenteAdmin, (req, res) => {
  if (!senhaCorreta(req)) return res.status(401).json({ erro: 'Senha de confirmação incorreta.' });

  const { tipo, associado_id } = req.body;
  if (!TIPOS_POR_VOTO.includes(tipo)) {
    return res.status(400).json({ erro: 'Esse prêmio não é lançado por voto.' });
  }
  const p = lerPeriodo(req.body);
  if (p.erro) return res.status(400).json({ erro: p.erro });

  const associado = db.prepare('SELECT id FROM associados WHERE id = ?').get(Number(associado_id));
  if (!associado) return res.status(404).json({ erro: 'Jogador não encontrado.' });

  const jaExiste = db
    .prepare(
      `SELECT id FROM premiacoes
       WHERE tipo = ? AND periodo = ? AND ano = ? AND mes = ? AND origem = 'manual'`
    )
    .get(tipo, p.periodo, p.ano, p.mes);
  if (jaExiste) {
    return res.status(409).json({
      erro: `${TIPOS[tipo].rotulo} já foi lançado nesse período. Remova o lançamento atual antes de trocar.`,
    });
  }

  db.prepare(
    `INSERT INTO premiacoes (tipo, periodo, ano, mes, associado_id, valor, origem, criado_por)
     VALUES (?, ?, ?, ?, ?, NULL, 'manual', ?)`
  ).run(tipo, p.periodo, p.ano, p.mes, associado.id, req.user.id);

  res.status(201).json({ mensagem: 'Premiação lançada.', premios: buscarPremiacoes(p) });
});

// DELETE /api/premiacoes/periodo { periodo, ano, mes, senha_confirmacao }
// Remove TODAS as premiações do período (automáticas e por voto). Declarada antes de
// /:id de propósito.
router.delete('/periodo', autenticar, somenteAdmin, (req, res) => {
  if (!senhaCorreta(req)) return res.status(401).json({ erro: 'Senha de confirmação incorreta.' });
  const p = lerPeriodo(req.body);
  if (p.erro) return res.status(400).json({ erro: p.erro });

  const { changes } = db
    .prepare('DELETE FROM premiacoes WHERE periodo = ? AND ano = ? AND mes = ?')
    .run(p.periodo, p.ano, p.mes);
  res.json({ mensagem: 'Premiações do período removidas.', removidas: changes });
});

// DELETE /api/premiacoes/:id { senha_confirmacao } -> remove um vencedor específico
router.delete('/:id', autenticar, somenteAdmin, (req, res) => {
  if (!senhaCorreta(req)) return res.status(401).json({ erro: 'Senha de confirmação incorreta.' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Premiação inválida.' });

  const { changes } = db.prepare('DELETE FROM premiacoes WHERE id = ?').run(id);
  if (changes === 0) return res.status(404).json({ erro: 'Premiação não encontrada.' });
  res.json({ mensagem: 'Premiação removida.' });
});

module.exports = router;
