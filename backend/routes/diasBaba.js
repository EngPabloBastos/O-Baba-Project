// routes/diasBaba.js
// "Dia de Baba": criação do evento, sorteio de times, suplentes, registro de
// partidas (placar + gols + assistências) e finalização (que trava o histórico).
//
// Regra de permissão geral: qualquer usuário autenticado (admin ou associado)
// pode VISUALIZAR o histórico e o detalhe de um Dia de Baba. Somente admin
// pode criar, sortear, mexer em suplentes, registrar partidas e finalizar.
//
// Regra de trava: depois que dia.status === 'finalizado', NENHUMA rota de
// escrita deste arquivo aceita alterações. Isso é checado em exigirAberto().

const express = require('express');
const db = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { calcularEstatisticas } = require('../lib/estatisticas');

const router = express.Router();

function tamanhoTime(formato) {
  return formato === '4x4' ? 4 : 5;
}

function buscarDia(id) {
  return db.prepare('SELECT * FROM dias_baba WHERE id = ?').get(id);
}

function exigirDia(req, res) {
  const dia = buscarDia(req.params.id);
  if (!dia) {
    res.status(404).json({ erro: 'Dia de Baba não encontrado.' });
    return null;
  }
  return dia;
}

function exigirAberto(dia, res) {
  if (dia.status !== 'aberto') {
    res.status(403).json({ erro: 'Este Dia de Baba já foi finalizado e não pode mais ser alterado.' });
    return false;
  }
  return true;
}

// Monta o objeto completo de um Dia de Baba: times, escalação, partidas e
// estatísticas daquele dia (usado tanto na tela de detalhe quanto na revisão
// pré-finalização).
function montarDetalhe(diaId) {
  const dia = buscarDia(diaId);
  if (!dia) return null;

  const times = db.prepare('SELECT * FROM times_dia WHERE dia_baba_id = ? ORDER BY id').all(diaId);

  const escalacoes = db
    .prepare(
      `SELECT esc.*,
              a.nome AS associado_nome, a.apelido AS associado_apelido,
              c.nome AS convidado_nome
       FROM escalacoes esc
       LEFT JOIN associados a ON a.id = esc.associado_id
       LEFT JOIN convidados c ON c.id = esc.convidado_id
       WHERE esc.dia_baba_id = ?`
    )
    .all(diaId)
    .map((e) => ({
      id: e.id,
      time_id: e.time_id,
      eh_suplente_para_time_id: e.eh_suplente_para_time_id,
      tipo: e.associado_id != null ? 'associado' : 'convidado',
      associado_id: e.associado_id,
      nome: e.associado_id != null ? e.associado_apelido || e.associado_nome : e.convidado_nome,
    }));

  const timesComJogadores = times.map((t) => ({
    ...t,
    titulares: escalacoes.filter((e) => e.time_id === t.id),
    suplentes: escalacoes.filter((e) => e.eh_suplente_para_time_id === t.id),
  }));

  const partidas = db
    .prepare('SELECT * FROM partidas WHERE dia_baba_id = ? ORDER BY ordem, id')
    .all(diaId)
    .map((p) => {
      const eventos = db
        .prepare(
          `SELECT ev.id, ev.tipo, ev.quantidade, ev.escalacao_id
           FROM eventos_partida ev WHERE ev.partida_id = ?`
        )
        .all(p.id)
        .map((ev) => ({
          ...ev,
          jogador: escalacoes.find((e) => e.id === ev.escalacao_id)?.nome ?? '(removido)',
        }));
      return { ...p, eventos };
    });

  const presentesSemTime = escalacoes.filter((e) => e.time_id == null);

  return {
    ...dia,
    times: timesComJogadores,
    presentes: escalacoes,
    presentes_sem_time: presentesSemTime,
    partidas,
    estatisticas_do_dia: calcularEstatisticas({ diaBabaId: diaId }),
  };
}

// GET /api/dias-baba -> histórico (qualquer usuário logado)
router.get('/', autenticar, (req, res) => {
  const dias = db
    .prepare(
      `SELECT d.*,
        (SELECT COUNT(*) FROM escalacoes WHERE dia_baba_id = d.id) AS total_presentes,
        (SELECT COUNT(*) FROM partidas WHERE dia_baba_id = d.id) AS total_partidas
       FROM dias_baba d ORDER BY d.data DESC, d.id DESC`
    )
    .all();
  res.json(dias);
});

// GET /api/dias-baba/:id -> detalhe completo (qualquer usuário logado)
router.get('/:id', autenticar, (req, res) => {
  const detalhe = montarDetalhe(req.params.id);
  if (!detalhe) return res.status(404).json({ erro: 'Dia de Baba não encontrado.' });
  res.json(detalhe);
});

// POST /api/dias-baba -> cria um novo Dia de Baba (somente admin)
// body: { data: 'YYYY-MM-DD', associados_presentes: [id,...], convidados_presentes: ['Nome',...] }
router.post('/', autenticar, somenteAdmin, (req, res) => {
  const { data, associados_presentes = [], convidados_presentes = [] } = req.body;

  if (!data) return res.status(400).json({ erro: 'Informe a data do Dia de Baba.' });
  if (associados_presentes.length + convidados_presentes.length === 0) {
    return res.status(400).json({ erro: 'Informe ao menos um associado ou convidado presente.' });
  }

  const inserirDia = db.prepare(
    `INSERT INTO dias_baba (data, criado_por_admin_id) VALUES (?, ?)`
  );
  const inserirConvidado = db.prepare(`INSERT INTO convidados (dia_baba_id, nome) VALUES (?, ?)`);
  const inserirEscalacaoAssociado = db.prepare(
    `INSERT INTO escalacoes (dia_baba_id, associado_id) VALUES (?, ?)`
  );
  const inserirEscalacaoConvidado = db.prepare(
    `INSERT INTO escalacoes (dia_baba_id, convidado_id) VALUES (?, ?)`
  );

  const diaId = db.transaction(() => {
    const resultado = inserirDia.run(data, req.user.id);
    const id = resultado.lastInsertRowid;

    for (const associadoId of associados_presentes) {
      inserirEscalacaoAssociado.run(id, associadoId);
    }
    for (const nomeConvidado of convidados_presentes) {
      const conv = inserirConvidado.run(id, nomeConvidado);
      inserirEscalacaoConvidado.run(id, conv.lastInsertRowid);
    }
    return id;
  })();

  res.status(201).json(montarDetalhe(diaId));
});

// PATCH /api/dias-baba/:id/presentes -> ajusta a lista de presentes (somente admin)
// Só permitido antes do sorteio (senão a lista de times ficaria inconsistente).
// body: { associados_presentes: [id,...], convidados_presentes: ['Nome',...] }
router.patch('/:id/presentes', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const jaTemTimes = db.prepare('SELECT COUNT(*) AS n FROM times_dia WHERE dia_baba_id = ?').get(dia.id).n > 0;
  if (jaTemTimes) {
    return res.status(400).json({ erro: 'Os times já foram sorteados. Ajuste a lista antes de sortear.' });
  }

  const { associados_presentes = [], convidados_presentes = [] } = req.body;

  db.transaction(() => {
    db.prepare('DELETE FROM escalacoes WHERE dia_baba_id = ?').run(dia.id);
    db.prepare('DELETE FROM convidados WHERE dia_baba_id = ?').run(dia.id);

    const inserirEscalacaoAssociado = db.prepare(
      `INSERT INTO escalacoes (dia_baba_id, associado_id) VALUES (?, ?)`
    );
    const inserirConvidado = db.prepare(`INSERT INTO convidados (dia_baba_id, nome) VALUES (?, ?)`);
    const inserirEscalacaoConvidado = db.prepare(
      `INSERT INTO escalacoes (dia_baba_id, convidado_id) VALUES (?, ?)`
    );

    for (const associadoId of associados_presentes) {
      inserirEscalacaoAssociado.run(dia.id, associadoId);
    }
    for (const nomeConvidado of convidados_presentes) {
      const conv = inserirConvidado.run(dia.id, nomeConvidado);
      inserirEscalacaoConvidado.run(dia.id, conv.lastInsertRowid);
    }
  })();

  res.json(montarDetalhe(dia.id));
});

// POST /api/dias-baba/:id/sorteio -> sorteia os times (somente admin)
// body: { formato: '4x4' | '5x5' }
router.post('/:id/sorteio', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const { formato } = req.body;
  if (!['4x4', '5x5'].includes(formato)) {
    return res.status(400).json({ erro: "formato deve ser '4x4' ou '5x5'." });
  }

  const temPartidasComPlacar = db
    .prepare(
      `SELECT COUNT(*) AS n FROM partidas WHERE dia_baba_id = ? AND gols_time_a IS NOT NULL`
    )
    .get(dia.id).n;
  if (temPartidasComPlacar > 0) {
    return res.status(400).json({
      erro: 'Já existem partidas com resultado registrado. Remova as partidas antes de sortear os times novamente.',
    });
  }

  const pool = db.prepare('SELECT id FROM escalacoes WHERE dia_baba_id = ?').all(dia.id);
  if (pool.length === 0) {
    return res.status(400).json({ erro: 'Não há jogadores presentes para sortear.' });
  }

  const tamanho = tamanhoTime(formato);
  const numTimes = Math.max(2, Math.ceil(pool.length / tamanho));

  // Fisher-Yates
  const embaralhado = pool.map((p) => p.id);
  for (let i = embaralhado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
  }

  db.transaction(() => {
    // Remove partidas antigas (sem placar, se houver) e limpa referências de time
    // antes de apagar os times antigos, para não violar as foreign keys.
    db.prepare('DELETE FROM partidas WHERE dia_baba_id = ?').run(dia.id);
    db.prepare(
      'UPDATE escalacoes SET time_id = NULL, eh_suplente_para_time_id = NULL WHERE dia_baba_id = ?'
    ).run(dia.id);
    db.prepare('DELETE FROM times_dia WHERE dia_baba_id = ?').run(dia.id);

    const inserirTime = db.prepare('INSERT INTO times_dia (dia_baba_id, nome) VALUES (?, ?)');
    const idsTimes = [];
    for (let i = 1; i <= numTimes; i++) {
      const r = inserirTime.run(dia.id, `Time ${i}`);
      idsTimes.push(r.lastInsertRowid);
    }

    const atualizarEscalacao = db.prepare('UPDATE escalacoes SET time_id = ? WHERE id = ?');
    embaralhado.forEach((escalacaoId, indice) => {
      const timeId = idsTimes[indice % numTimes];
      atualizarEscalacao.run(timeId, escalacaoId);
    });

    db.prepare('UPDATE dias_baba SET formato = ? WHERE id = ?').run(formato, dia.id);
  })();

  res.json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/escalacoes/:escalacaoId/suplente -> marca/desmarca suplência
// body: { eh_suplente_para_time_id: number | null }
// O jogador continua no seu time original (time_id não muda); só passa a também
// contar como suplente do time indicado, para completar o número de jogadores.
router.patch('/:id/escalacoes/:escalacaoId/suplente', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const escalacao = db
    .prepare('SELECT * FROM escalacoes WHERE id = ? AND dia_baba_id = ?')
    .get(req.params.escalacaoId, dia.id);
  if (!escalacao) return res.status(404).json({ erro: 'Jogador não encontrado neste Dia de Baba.' });

  const { eh_suplente_para_time_id } = req.body;

  if (eh_suplente_para_time_id != null) {
    const timeAlvo = db
      .prepare('SELECT * FROM times_dia WHERE id = ? AND dia_baba_id = ?')
      .get(eh_suplente_para_time_id, dia.id);
    if (!timeAlvo) return res.status(400).json({ erro: 'Time inválido para este Dia de Baba.' });
    if (timeAlvo.id === escalacao.time_id) {
      return res.status(400).json({ erro: 'O jogador já pertence a esse time; não faz sentido ser suplente dele.' });
    }
  }

  db.prepare('UPDATE escalacoes SET eh_suplente_para_time_id = ? WHERE id = ?').run(
    eh_suplente_para_time_id ?? null,
    escalacao.id
  );

  res.json(montarDetalhe(dia.id));
});

// POST /api/dias-baba/:id/partidas -> registra um confronto entre dois times (somente admin)
// body: { time_a_id, time_b_id }
router.post('/:id/partidas', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const { time_a_id, time_b_id } = req.body;
  if (!time_a_id || !time_b_id || time_a_id === time_b_id) {
    return res.status(400).json({ erro: 'Informe dois times diferentes.' });
  }
  const times = db.prepare('SELECT id FROM times_dia WHERE dia_baba_id = ? AND id IN (?, ?)').all(
    dia.id,
    time_a_id,
    time_b_id
  );
  if (times.length !== 2) {
    return res.status(400).json({ erro: 'Times inválidos para este Dia de Baba.' });
  }

  const ordem = db.prepare('SELECT COUNT(*) AS n FROM partidas WHERE dia_baba_id = ?').get(dia.id).n + 1;

  const resultado = db
    .prepare(
      `INSERT INTO partidas (dia_baba_id, time_a_id, time_b_id, ordem) VALUES (?, ?, ?, ?)`
    )
    .run(dia.id, time_a_id, time_b_id, ordem);

  res.status(201).json(montarDetalhe(dia.id));
  void resultado;
});

// PUT /api/dias-baba/:id/partidas/:partidaId -> registra placar + gols + assistências (somente admin)
// body: { gols_time_a, gols_time_b, eventos: [{ escalacao_id, tipo: 'gol'|'assistencia', quantidade }] }
// "eventos" substitui por completo os eventos já lançados dessa partida (evita duplicação).
router.put('/:id/partidas/:partidaId', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const partida = db
    .prepare('SELECT * FROM partidas WHERE id = ? AND dia_baba_id = ?')
    .get(req.params.partidaId, dia.id);
  if (!partida) return res.status(404).json({ erro: 'Partida não encontrada.' });

  const { gols_time_a, gols_time_b, eventos = [] } = req.body;
  if (
    !Number.isInteger(gols_time_a) ||
    !Number.isInteger(gols_time_b) ||
    gols_time_a < 0 ||
    gols_time_b < 0
  ) {
    return res.status(400).json({ erro: 'Informe o placar (gols_time_a e gols_time_b) como números inteiros ≥ 0.' });
  }

  // Só aceita eventos de quem realmente jogou essa partida (titular ou suplente de um dos dois times).
  const participantesValidos = new Set(
    db
      .prepare(
        `SELECT id FROM escalacoes WHERE dia_baba_id = ?
         AND (time_id IN (?, ?) OR eh_suplente_para_time_id IN (?, ?))`
      )
      .all(dia.id, partida.time_a_id, partida.time_b_id, partida.time_a_id, partida.time_b_id)
      .map((e) => e.id)
  );

  for (const ev of eventos) {
    if (!participantesValidos.has(ev.escalacao_id)) {
      return res.status(400).json({ erro: 'Um dos jogadores informados não jogou essa partida.' });
    }
    if (!['gol', 'assistencia'].includes(ev.tipo)) {
      return res.status(400).json({ erro: "tipo de evento deve ser 'gol' ou 'assistencia'." });
    }
  }

  db.transaction(() => {
    db.prepare('UPDATE partidas SET gols_time_a = ?, gols_time_b = ? WHERE id = ?').run(
      gols_time_a,
      gols_time_b,
      partida.id
    );
    db.prepare('DELETE FROM eventos_partida WHERE partida_id = ?').run(partida.id);
    const inserirEvento = db.prepare(
      `INSERT INTO eventos_partida (partida_id, escalacao_id, tipo, quantidade) VALUES (?, ?, ?, ?)`
    );
    for (const ev of eventos) {
      inserirEvento.run(partida.id, ev.escalacao_id, ev.tipo, ev.quantidade || 1);
    }
  })();

  res.json(montarDetalhe(dia.id));
});

// DELETE /api/dias-baba/:id/partidas/:partidaId -> remove uma partida (somente admin)
router.delete('/:id/partidas/:partidaId', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const resultado = db
    .prepare('DELETE FROM partidas WHERE id = ? AND dia_baba_id = ?')
    .run(req.params.partidaId, dia.id);
  if (resultado.changes === 0) return res.status(404).json({ erro: 'Partida não encontrada.' });

  res.json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/finalizar -> trava o Dia de Baba definitivamente (somente admin)
// O front-end deve pedir confirmação ao usuário ANTES de chamar esta rota;
// o backend não pede uma segunda confirmação porque não há "desfazer".
router.patch('/:id/finalizar', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const temTimes = db.prepare('SELECT COUNT(*) AS n FROM times_dia WHERE dia_baba_id = ?').get(dia.id).n;
  if (temTimes === 0) {
    return res.status(400).json({ erro: 'Sorteie os times antes de finalizar o Dia de Baba.' });
  }

  db.prepare(
    `UPDATE dias_baba SET status = 'finalizado', finalizado_em = datetime('now') WHERE id = ?`
  ).run(dia.id);

  res.json(montarDetalhe(dia.id));
});

module.exports = router;
