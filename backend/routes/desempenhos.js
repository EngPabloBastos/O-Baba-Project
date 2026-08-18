// routes/desempenhos.js
// Seção "Desempenhos": estatísticas e rankings dos associados (mensal/anual).
// Leitura disponível para admin E associado — ninguém edita nada por aqui,
// os números vêm sempre calculados a partir das partidas já registradas.

const express = require('express');
const { autenticar } = require('../middleware/auth');
const { calcularEstatisticas } = require('../lib/estatisticas');

const router = express.Router();

function periodoDaQuery(req) {
  const agora = new Date();
  const periodo = req.query.periodo === 'anual' ? 'anual' : 'mensal';
  const ano = req.query.ano ? Number(req.query.ano) : agora.getFullYear();
  const mes = periodo === 'mensal' ? (req.query.mes ? Number(req.query.mes) : agora.getMonth() + 1) : undefined;
  return { periodo, ano, mes };
}

// GET /api/desempenhos?periodo=mensal|anual&ano=2026&mes=8
// Estatísticas completas (gols, assistências, vitórias, pontuação) de todos os associados
// que tiveram alguma participação no período, já ordenadas por pontuação.
router.get('/', autenticar, (req, res) => {
  const { periodo, ano, mes } = periodoDaQuery(req);
  const estatisticas = calcularEstatisticas({ ano, mes });
  res.json({ periodo, ano, mes: mes ?? null, estatisticas });
});

// GET /api/desempenhos/me?periodo=mensal|anual&ano=&mes=
// Atalho para o próprio associado ver só o seu número no período.
router.get('/me', autenticar, (req, res) => {
  if (req.user.role !== 'associado') {
    return res.status(403).json({ erro: 'Rota disponível apenas para associados.' });
  }
  const { periodo, ano, mes } = periodoDaQuery(req);
  const estatisticas = calcularEstatisticas({ ano, mes });
  const meu = estatisticas.find((e) => e.associado_id === req.user.id) || {
    associado_id: req.user.id,
    nome: req.user.nome,
    apelido: null,
    gols: 0,
    assistencias: 0,
    vitorias: 0,
    pontuacao: 0,
  };
  res.json({ periodo, ano, mes: mes ?? null, estatisticas: meu });
});

// GET /api/desempenhos/ranking?tipo=pontuacao|gols|assistencias|vitorias&periodo=mensal|anual&ano=&mes=
router.get('/ranking', autenticar, (req, res) => {
  const tipo = ['pontuacao', 'gols', 'assistencias', 'vitorias'].includes(req.query.tipo)
    ? req.query.tipo
    : 'pontuacao';
  const { periodo, ano, mes } = periodoDaQuery(req);

  const estatisticas = calcularEstatisticas({ ano, mes }).sort((a, b) => b[tipo] - a[tipo]);

  const ranking = estatisticas.map((e, indice) => ({ posicao: indice + 1, ...e }));

  res.json({ tipo, periodo, ano, mes: mes ?? null, ranking });
});

module.exports = router;
