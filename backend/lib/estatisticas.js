// lib/estatisticas.js
// Cálculo das estatísticas de cada associado (gols, assistências, vitórias,
// pontuação), usado tanto na revisão de um Dia de Baba quanto nos rankings.
// Vitórias nunca são lançadas manualmente: são derivadas do placar aqui.

const db = require('../db');

/**
 * @param {{ ano?: number, mes?: number, diaBabaId?: number }} filtros
 *   - ano + mes  -> estatísticas daquele mês
 *   - ano apenas -> estatísticas daquele ano inteiro
 *   - nenhum     -> estatísticas de todo o histórico
 *   - diaBabaId  -> restringe a um único Dia de Baba (usado na revisão pré-finalização)
 * @returns {Array<{associado_id:number, nome:string, apelido:string|null, gols:number, assistencias:number, vitorias:number, pontuacao:number}>}
 */
function calcularEstatisticas(filtros = {}) {
  const { ano, mes, diaBabaId } = filtros;

  let sqlDias = `SELECT id FROM dias_baba WHERE 1=1`;
  const paramsDias = [];
  if (diaBabaId) {
    sqlDias += ' AND id = ?';
    paramsDias.push(diaBabaId);
  }
  if (ano) {
    sqlDias += ` AND strftime('%Y', data) = ?`;
    paramsDias.push(String(ano));
  }
  if (mes) {
    sqlDias += ` AND strftime('%m', data) = ?`;
    paramsDias.push(String(mes).padStart(2, '0'));
  }
  const diasRelevantes = db.prepare(sqlDias).all(...paramsDias).map((d) => d.id);

  const acumulado = new Map(); // associado_id -> { gols, assistencias, vitorias }

  function garantir(associadoId) {
    if (!acumulado.has(associadoId)) {
      acumulado.set(associadoId, { gols: 0, assistencias: 0, vitorias: 0 });
    }
    return acumulado.get(associadoId);
  }

  for (const idDia of diasRelevantes) {
    const partidas = db
      .prepare(
        `SELECT * FROM partidas WHERE dia_baba_id = ? AND encerrada = 1`
      )
      .all(idDia);

    for (const partida of partidas) {
      // Vitórias ficam gravadas por jogador desde o momento em que a partida foi
      // encerrada (ver vitorias_partida em db.js) — não são mais derivadas do time
      // atual de cada um, que pode mudar depois e embaralhar o histórico.
      const vencedores = db
        .prepare(
          `SELECT e.associado_id AS associado_id
           FROM vitorias_partida v
           JOIN escalacoes e ON e.id = v.escalacao_id
           WHERE v.partida_id = ?`
        )
        .all(partida.id);
      for (const { associado_id: associadoId } of vencedores) {
        if (associadoId == null) continue;
        garantir(associadoId).vitorias += 1;
      }

      const eventos = db
        .prepare(
          `SELECT ev.*, e.associado_id AS associado_id
           FROM eventos_partida ev
           JOIN escalacoes e ON e.id = ev.escalacao_id
           WHERE ev.partida_id = ?`
        )
        .all(partida.id);

      for (const evento of eventos) {
        if (evento.associado_id == null) continue; // gol/assistência de convidado não conta no ranking
        const stats = garantir(evento.associado_id);
        if (evento.tipo === 'gol') stats.gols += evento.quantidade;
        if (evento.tipo === 'assistencia') stats.assistencias += evento.quantidade;
      }
    }
  }

  const associadoIds = [...acumulado.keys()];
  if (associadoIds.length === 0) return [];

  const placeholders = associadoIds.map(() => '?').join(',');
  const associados = db
    .prepare(`SELECT id, nome, apelido FROM associados WHERE id IN (${placeholders})`)
    .all(...associadoIds);
  const infoPorId = new Map(associados.map((a) => [a.id, a]));

  return associadoIds
    .map((id) => {
      const s = acumulado.get(id);
      const info = infoPorId.get(id);
      const pontuacao = s.gols * 3 + s.assistencias * 2 + s.vitorias * 1;
      return {
        associado_id: id,
        nome: info?.nome ?? '(associado removido)',
        apelido: info?.apelido ?? null,
        gols: s.gols,
        assistencias: s.assistencias,
        vitorias: s.vitorias,
        pontuacao,
      };
    })
    .sort((a, b) => b.pontuacao - a.pontuacao);
}

module.exports = { calcularEstatisticas };
