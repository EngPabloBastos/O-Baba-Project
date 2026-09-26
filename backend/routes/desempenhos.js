// routes/desempenhos.js
// Rankings dos associados (mensal/anual), somente leitura.

const express = require('express');
const db = require('../db');
const { autenticar } = require('../middleware/auth');
const { calcularEstatisticas } = require('../lib/estatisticas');

const router = express.Router();

// Tipos que podem ser usados pra ordenar o ranking. "vitorias" não é mais um tipo de
// ranking (times são rotativos, então o foco virou desempenho individual via G/A),
// mas a vitória continua sendo contabilizada e aparece normalmente na ficha de cada
// jogador.
const TIPOS_RANKING = ['pontuacao', 'gols', 'assistencias', 'ga', 'media_ga'];

function periodoDaQuery(req) {
  const agora = new Date();
  if (req.query.periodo === 'geral') return { periodo: 'geral', ano: undefined, mes: undefined };
  const periodo = req.query.periodo === 'anual' ? 'anual' : 'mensal';
  const ano = req.query.ano ? Number(req.query.ano) : agora.getFullYear();
  const mes = periodo === 'mensal' ? (req.query.mes ? Number(req.query.mes) : agora.getMonth() + 1) : undefined;
  return { periodo, ano, mes };
}

function estatisticasVazias(associadoId, nome, apelido) {
  return {
    associado_id: associadoId,
    nome,
    apelido,
    gols: 0,
    assistencias: 0,
    vitorias: 0,
    jogos: 0,
    ga: 0,
    media_ga: 0,
    pontuacao: 0,
  };
}

// GET /api/desempenhos?periodo=mensal|anual|geral&ano=2026&mes=8
// Estatísticas completas (gols, assistências, vitórias, jogos, G/A, pontuação) de
// todos os associados que tiveram alguma participação no período, já ordenadas por
// pontuação. periodo=geral ignora ano/mes e traz o histórico completo do associado.
router.get('/', autenticar, (req, res) => {
  const { periodo, ano, mes } = periodoDaQuery(req);
  const estatisticas = calcularEstatisticas({ ano, mes });
  res.json({ periodo, ano, mes: mes ?? null, estatisticas });
});

// GET /api/desempenhos/me?periodo=mensal|anual|geral&ano=&mes=
// Atalho para o próprio associado ver só o seu número no período (usado no Perfil
// com periodo=geral pra mostrar o total de gols/assistências da carreira).
router.get('/me', autenticar, (req, res) => {
  if (req.user.role !== 'associado') {
    return res.status(403).json({ erro: 'Rota disponível apenas para associados.' });
  }
  const { periodo, ano, mes } = periodoDaQuery(req);
  const estatisticas = calcularEstatisticas({ ano, mes });
  const meu = estatisticas.find((e) => e.associado_id === req.user.id) || estatisticasVazias(req.user.id, req.user.nome, null);
  res.json({ periodo, ano, mes: mes ?? null, estatisticas: meu });
});

// GET /api/desempenhos/ranking?tipo=pontuacao|gols|assistencias|ga|media_ga&periodo=mensal|anual&ano=&mes=
router.get('/ranking', autenticar, (req, res) => {
  const tipo = TIPOS_RANKING.includes(req.query.tipo) ? req.query.tipo : 'pontuacao';
  const { periodo, ano, mes } = periodoDaQuery(req);

  const estatisticas = calcularEstatisticas({ ano, mes }).sort((a, b) => b[tipo] - a[tipo]);

  const ranking = estatisticas.map((e, indice) => ({ posicao: indice + 1, ...e }));

  res.json({ tipo, periodo, ano, mes: mes ?? null, ranking });
});

// GET /api/desempenhos/:associadoId?periodo=mensal|anual|geral&ano=&mes=
// Estatísticas de um associado específico — usado pra qualquer usuário logado ver o
// perfil (com estatísticas) de outro jogador. Fica depois de /me e /ranking de
// propósito, pra essas rotas literais serem casadas primeiro.
router.get('/:associadoId', autenticar, (req, res) => {
  const associadoId = Number(req.params.associadoId);
  if (!Number.isInteger(associadoId)) {
    return res.status(400).json({ erro: 'Associado inválido.' });
  }

  const associado = db.prepare('SELECT id, nome, apelido FROM associados WHERE id = ?').get(associadoId);
  if (!associado) {
    return res.status(404).json({ erro: 'Associado não encontrado.' });
  }

  const { periodo, ano, mes } = periodoDaQuery(req);
  const estatisticas = calcularEstatisticas({ ano, mes });
  const dele =
    estatisticas.find((e) => e.associado_id === associadoId) ||
    estatisticasVazias(associadoId, associado.nome, associado.apelido);
  res.json({ periodo, ano, mes: mes ?? null, estatisticas: dele });
});

module.exports = router;
