// lib/premiacoes.js
// Regras das premiações (Hall da Fama): quais existem, como as automáticas são
// calculadas e as consultas usadas pelas rotas.

const db = require('../db');
const { calcularEstatisticas } = require('./estatisticas');

// Ordem = ordem em que aparecem no Hall da Fama e no perfil.
const TIPOS = {
  artilheiro: { rotulo: 'Artilheiro', origem: 'automatica', campo: 'gols', unidade: 'gols' },
  garcom: { rotulo: 'Garçom', origem: 'automatica', campo: 'assistencias', unidade: 'assistências' },
  melhor_jogador_por_pontos: {
    rotulo: 'Melhor Jogador por Pontos',
    origem: 'automatica',
    campo: 'pontuacao',
    unidade: 'pontos',
  },
  melhor_jogador_por_voto: { rotulo: 'Melhor Jogador por Voto', origem: 'manual' },
  xerife: { rotulo: 'Xerife', origem: 'manual' },
  melhor_goleiro: { rotulo: 'Melhor Goleiro', origem: 'manual' },
};
const ORDEM = Object.keys(TIPOS);
const TIPOS_AUTOMATICOS = ORDEM.filter((t) => TIPOS[t].origem === 'automatica');
const TIPOS_POR_VOTO = ORDEM.filter((t) => TIPOS[t].origem === 'manual');

/**
 * Vencedor(es) de um prêmio automático. Regras: precisa ter pelo menos 1 no critério;
 * empate no critério é decidido por quem jogou MENOS partidas; se ainda empatar,
 * os empatados dividem o prêmio.
 */
function vencedoresAutomaticos(estatisticas, campo) {
  const candidatos = estatisticas.filter((e) => e[campo] > 0);
  if (candidatos.length === 0) return [];
  const maior = Math.max(...candidatos.map((e) => e[campo]));
  const topo = candidatos.filter((e) => e[campo] === maior);
  const menosJogos = Math.min(...topo.map((e) => e.jogos));
  return topo.filter((e) => e.jogos === menosJogos);
}

/**
 * Calcula e grava as 3 premiações automáticas de um período. Se o período já tinha sido
 * fechado, recalcula só as automáticas (as lançadas por voto ficam intactas).
 * @returns {{ total_jogadores: number, gravadas: number } | null} null se não há estatísticas
 */
function fecharPeriodo({ periodo, ano, mes }, adminId) {
  const estatisticas = calcularEstatisticas(periodo === 'mensal' ? { ano, mes } : { ano });
  if (estatisticas.length === 0) return null;

  let gravadas = 0;
  db.transaction(() => {
    db.prepare(
      `DELETE FROM premiacoes WHERE periodo = ? AND ano = ? AND mes = ? AND origem = 'automatica'`
    ).run(periodo, ano, mes);

    const inserir = db.prepare(
      `INSERT INTO premiacoes (tipo, periodo, ano, mes, associado_id, valor, origem, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, 'automatica', ?)`
    );
    for (const tipo of TIPOS_AUTOMATICOS) {
      const { campo } = TIPOS[tipo];
      for (const v of vencedoresAutomaticos(estatisticas, campo)) {
        inserir.run(tipo, periodo, ano, mes, v.associado_id, v[campo], adminId ?? null);
        gravadas += 1;
      }
    }
  })();

  return { total_jogadores: estatisticas.length, gravadas };
}

/** Períodos que já têm alguma premiação (é o que o seletor do Hall da Fama lista). */
function listarPeriodos() {
  const mensais = db
    .prepare(`SELECT DISTINCT ano, mes FROM premiacoes WHERE periodo = 'mensal' ORDER BY ano DESC, mes DESC`)
    .all();
  const anuais = db
    .prepare(`SELECT DISTINCT ano FROM premiacoes WHERE periodo = 'anual' ORDER BY ano DESC`)
    .all()
    .map((r) => r.ano);
  return { mensais, anuais };
}

/** Os 6 prêmios de um período, cada um com a lista de vencedores (vazia se não definido). */
function buscarPremiacoes({ periodo, ano, mes }) {
  const linhas = db
    .prepare(
      `SELECT p.id, p.tipo, p.associado_id, p.valor, p.origem, a.nome, a.apelido, a.foto_url
       FROM premiacoes p
       JOIN associados a ON a.id = p.associado_id
       WHERE p.periodo = ? AND p.ano = ? AND p.mes = ?
       ORDER BY p.id`
    )
    .all(periodo, ano, mes);

  return ORDEM.map((tipo) => ({
    tipo,
    rotulo: TIPOS[tipo].rotulo,
    origem: TIPOS[tipo].origem,
    unidade: TIPOS[tipo].unidade ?? null,
    vencedores: linhas
      .filter((l) => l.tipo === tipo)
      .map((l) => ({
        id: l.id,
        associado_id: l.associado_id,
        nome: l.nome,
        apelido: l.apelido,
        foto_url: l.foto_url,
        valor: l.valor,
      })),
  }));
}

/** Conquistas de um jogador, agrupadas por prêmio (só os que ele ganhou). */
function conquistasDoJogador(associadoId) {
  const linhas = db
    .prepare(
      `SELECT tipo, periodo, ano, mes FROM premiacoes
       WHERE associado_id = ? ORDER BY ano, mes`
    )
    .all(associadoId);

  const mensais = [];
  const anuais = [];
  for (const tipo of ORDEM) {
    const doTipo = linhas.filter((l) => l.tipo === tipo);
    const m = doTipo.filter((l) => l.periodo === 'mensal').map((l) => ({ ano: l.ano, mes: l.mes }));
    const a = doTipo.filter((l) => l.periodo === 'anual').map((l) => l.ano);
    if (m.length) mensais.push({ tipo, rotulo: TIPOS[tipo].rotulo, quantidade: m.length, periodos: m });
    if (a.length) anuais.push({ tipo, rotulo: TIPOS[tipo].rotulo, quantidade: a.length, periodos: a });
  }
  return { mensais, anuais };
}

module.exports = {
  TIPOS,
  TIPOS_POR_VOTO,
  vencedoresAutomaticos,
  fecharPeriodo,
  listarPeriodos,
  buscarPremiacoes,
  conquistasDoJogador,
};
