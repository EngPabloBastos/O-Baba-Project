// routes/diasBaba.js
// "Dia de Baba": criação do evento, organização dos times (com vagas),
// o motor de fila "vencedor fica" e o registro de gols ao vivo.
//
// Regra de permissão geral: qualquer usuário autenticado (admin ou associado)
// pode VISUALIZAR o histórico e o detalhe. Somente admin escreve.
//
// Regra de trava: depois que dia.status === 'finalizado', NENHUMA rota de
// escrita deste arquivo aceita alterações (exigirAberto()).
//
// ---------- Como funciona a fila "vencedor fica" ----------
// Ao clicar "Iniciar Baba", os times entram numa fila (fila_times) na ordem
// Time 1, Time 2, Time 3... Os dois primeiros saem da fila e formam a
// primeira partida (ao vivo). Quando o admin clica "Encerrar partida":
//   - Se não deu empate: o time vencedor segue direto para a próxima partida;
//     o perdedor vai para o final da fila; o próximo adversário do vencedor
//     é quem estiver na frente da fila.
//   - Se deu empate:
//       - Havendo 2+ times esperando: os dois times empatados vão para o
//         final da fila (a ordem entre os dois é decidida por sorteio); a
//         próxima partida é entre os dois primeiros da fila (times "frescos").
//       - Havendo 0 ou 1 time esperando: sorteio decide qual dos dois
//         empatados CONTINUA na quadra; o outro vai para a fila.
// Tudo isso é reversível uma única vez (PATCH .../reabrir), desde que a
// partida seguinte ainda não tenha nenhum gol registrado.

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

// ---------- helpers da fila (sempre chamados dentro de uma db.transaction) ----------

function listaFila(diaId) {
  return db
    .prepare(
      `SELECT f.id, f.time_id, f.posicao, t.nome
       FROM fila_times f JOIN times_dia t ON t.id = f.time_id
       WHERE f.dia_baba_id = ? ORDER BY f.posicao`
    )
    .all(diaId);
}

function definirFila(diaId, idsTimes) {
  db.prepare('DELETE FROM fila_times WHERE dia_baba_id = ?').run(diaId);
  const inserir = db.prepare('INSERT INTO fila_times (dia_baba_id, time_id, posicao) VALUES (?, ?, ?)');
  idsTimes.forEach((timeId, indice) => inserir.run(diaId, timeId, indice));
}

function popFila(diaId) {
  const proximo = db
    .prepare('SELECT * FROM fila_times WHERE dia_baba_id = ? ORDER BY posicao LIMIT 1')
    .get(diaId);
  if (!proximo) return null;
  db.prepare('DELETE FROM fila_times WHERE id = ?').run(proximo.id);
  return proximo.time_id;
}

function pushFila(diaId, timeId) {
  const maior = db
    .prepare('SELECT COALESCE(MAX(posicao), -1) AS max FROM fila_times WHERE dia_baba_id = ?')
    .get(diaId).max;
  db.prepare('INSERT INTO fila_times (dia_baba_id, time_id, posicao) VALUES (?, ?, ?)').run(
    diaId,
    timeId,
    maior + 1
  );
}

// Monta o objeto completo de um Dia de Baba: times (com vagas), fila,
// partida ao vivo, histórico de partidas encerradas e estatísticas do dia.
function montarDetalhe(diaId) {
  const dia = buscarDia(diaId);
  if (!dia) return null;

  const times = db.prepare('SELECT * FROM times_dia WHERE dia_baba_id = ? ORDER BY id').all(diaId);
  const nomePorTime = new Map(times.map((t) => [t.id, t.nome]));

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

  const tamanho = dia.formato ? tamanhoTime(dia.formato) : null;

  const timesComJogadores = times.map((t) => {
    const titulares = escalacoes.filter((e) => e.time_id === t.id);
    const suplentes = escalacoes.filter((e) => e.eh_suplente_para_time_id === t.id);
    const vagas = tamanho ? Math.max(0, tamanho - titulares.length - suplentes.length) : 0;
    return { ...t, titulares, suplentes, vagas };
  });

  const fila = listaFila(diaId);

  function participantesDaPartida(partida) {
    const timeA = timesComJogadores.find((t) => t.id === partida.time_a_id);
    const timeB = timesComJogadores.find((t) => t.id === partida.time_b_id);
    return [...(timeA?.titulares || []), ...(timeA?.suplentes || []), ...(timeB?.titulares || []), ...(timeB?.suplentes || [])];
  }

  function comEventos(partida) {
    const eventos = db
      .prepare(`SELECT id, tipo, quantidade, escalacao_id FROM eventos_partida WHERE partida_id = ?`)
      .all(partida.id)
      .map((ev) => ({
        ...ev,
        jogador: escalacoes.find((e) => e.id === ev.escalacao_id)?.nome ?? '(removido)',
      }));
    return {
      ...partida,
      time_a_nome: nomePorTime.get(partida.time_a_id),
      time_b_nome: nomePorTime.get(partida.time_b_id),
      eventos,
    };
  }

  const partidaAtualRaw = db
    .prepare('SELECT * FROM partidas WHERE dia_baba_id = ? AND encerrada = 0 ORDER BY ordem DESC LIMIT 1')
    .get(diaId);
  const partidaAtual = partidaAtualRaw
    ? { ...comEventos(partidaAtualRaw), participantes: participantesDaPartida(partidaAtualRaw) }
    : null;

  const partidasFinalizadas = db
    .prepare('SELECT * FROM partidas WHERE dia_baba_id = ? AND encerrada = 1 ORDER BY ordem')
    .all(diaId)
    .map((p) => ({
      ...comEventos(p),
      pode_reabrir: !!(partidaAtual && p.partida_seguinte_id === partidaAtual.id && partidaAtual.eventos.length === 0),
    }));

  const presentesSemTime = escalacoes.filter((e) => e.time_id == null);

  return {
    ...dia,
    baba_iniciado: !!dia.baba_iniciado,
    times: timesComJogadores,
    presentes: escalacoes,
    presentes_sem_time: presentesSemTime,
    fila,
    partida_atual: partidaAtual,
    partidas_finalizadas: partidasFinalizadas,
    estatisticas_do_dia: calcularEstatisticas({ diaBabaId: diaId }),
  };
}

// GET /api/dias-baba -> histórico (qualquer usuário logado)
router.get('/', autenticar, (req, res) => {
  const dias = db
    .prepare(
      `SELECT d.*,
        (SELECT COUNT(*) FROM escalacoes WHERE dia_baba_id = d.id) AS total_presentes,
        (SELECT COUNT(*) FROM partidas WHERE dia_baba_id = d.id AND encerrada = 1) AS total_partidas
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
router.post('/', autenticar, somenteAdmin, (req, res) => {
  const { data, associados_presentes = [], convidados_presentes = [] } = req.body;

  if (!data) return res.status(400).json({ erro: 'Informe a data do Dia de Baba.' });
  if (associados_presentes.length + convidados_presentes.length === 0) {
    return res.status(400).json({ erro: 'Informe ao menos um associado ou convidado presente.' });
  }

  const inserirDia = db.prepare(`INSERT INTO dias_baba (data, criado_por_admin_id) VALUES (?, ?)`);
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
    for (const associadoId of associados_presentes) inserirEscalacaoAssociado.run(id, associadoId);
    for (const nomeConvidado of convidados_presentes) {
      const conv = inserirConvidado.run(id, nomeConvidado);
      inserirEscalacaoConvidado.run(id, conv.lastInsertRowid);
    }
    return id;
  })();

  res.status(201).json(montarDetalhe(diaId));
});

// PATCH /api/dias-baba/:id/presentes -> ajusta a lista de presentes (somente admin, antes do sorteio)
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

    for (const associadoId of associados_presentes) inserirEscalacaoAssociado.run(dia.id, associadoId);
    for (const nomeConvidado of convidados_presentes) {
      const conv = inserirConvidado.run(dia.id, nomeConvidado);
      inserirEscalacaoConvidado.run(dia.id, conv.lastInsertRowid);
    }
  })();

  res.json(montarDetalhe(dia.id));
});

// POST /api/dias-baba/:id/sorteio -> sorteia os times (somente admin, antes de iniciar o baba)
// Preenche os times em sequência (Time 1 primeiro, até o tamanho do formato,
// depois Time 2, etc) — assim só o(s) último(s) time(s) ficam com vagas.
router.post('/:id/sorteio', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  if (dia.baba_iniciado) {
    return res.status(400).json({ erro: "O baba já foi iniciado. Use 'Editar times' para fazer ajustes." });
  }

  const { formato } = req.body;
  if (!['4x4', '5x5'].includes(formato)) {
    return res.status(400).json({ erro: "formato deve ser '4x4' ou '5x5'." });
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
    db.prepare('DELETE FROM fila_times WHERE dia_baba_id = ?').run(dia.id);
    db.prepare('DELETE FROM partidas WHERE dia_baba_id = ?').run(dia.id);
    db.prepare(
      'UPDATE escalacoes SET time_id = NULL, eh_suplente_para_time_id = NULL WHERE dia_baba_id = ?'
    ).run(dia.id);
    db.prepare('DELETE FROM times_dia WHERE dia_baba_id = ?').run(dia.id);

    const inserirTime = db.prepare('INSERT INTO times_dia (dia_baba_id, nome) VALUES (?, ?)');
    const idsTimes = [];
    for (let i = 1; i <= numTimes; i++) {
      idsTimes.push(inserirTime.run(dia.id, `Time ${i}`).lastInsertRowid);
    }

    // preenchimento sequencial: enche o time atual até o tamanho antes de passar pro próximo
    const atualizarEscalacao = db.prepare('UPDATE escalacoes SET time_id = ? WHERE id = ?');
    let cursor = 0;
    for (let i = 0; i < idsTimes.length; i++) {
      for (let vaga = 0; vaga < tamanho && cursor < embaralhado.length; vaga++, cursor++) {
        atualizarEscalacao.run(idsTimes[i], embaralhado[cursor]);
      }
    }

    db.prepare('UPDATE dias_baba SET formato = ? WHERE id = ?').run(formato, dia.id);
  })();

  res.json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/escalacoes/:escalacaoId/suplente -> ocupa/libera uma vaga
// O jogador continua no seu time original (time_id não muda); só passa a também
// contar como suplente do time indicado, para completar o número de jogadores.
// Funciona a qualquer momento enquanto o dia estiver aberto (mesmo com o baba já iniciado).
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

// PATCH /api/dias-baba/:id/escalacoes/:escalacaoId/time -> move um jogador de vez para outro time
// (correção manual do admin — diferente de "suplente", que mantém o time original).
router.patch('/:id/escalacoes/:escalacaoId/time', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const escalacao = db
    .prepare('SELECT * FROM escalacoes WHERE id = ? AND dia_baba_id = ?')
    .get(req.params.escalacaoId, dia.id);
  if (!escalacao) return res.status(404).json({ erro: 'Jogador não encontrado neste Dia de Baba.' });

  const { time_id } = req.body;
  const timeAlvo = db.prepare('SELECT * FROM times_dia WHERE id = ? AND dia_baba_id = ?').get(time_id, dia.id);
  if (!timeAlvo) return res.status(400).json({ erro: 'Time inválido para este Dia de Baba.' });

  db.transaction(() => {
    db.prepare('UPDATE escalacoes SET time_id = ? WHERE id = ?').run(time_id, escalacao.id);
    // se ele virou titular do time que ajudava como suplente, a suplência não faz mais sentido
    if (escalacao.eh_suplente_para_time_id === time_id) {
      db.prepare('UPDATE escalacoes SET eh_suplente_para_time_id = NULL WHERE id = ?').run(escalacao.id);
    }
  })();

  res.json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/escalacoes/:escalacaoId/remover -> tira o jogador do time
// (ex: foi embora mais cedo). Ele NÃO é apagado do Dia de Baba — só fica "sem time",
// disponível pra voltar depois (ver presentes_sem_time no detalhe).
router.patch('/:id/escalacoes/:escalacaoId/remover', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const escalacao = db
    .prepare('SELECT * FROM escalacoes WHERE id = ? AND dia_baba_id = ?')
    .get(req.params.escalacaoId, dia.id);
  if (!escalacao) return res.status(404).json({ erro: 'Jogador não encontrado neste Dia de Baba.' });

  db.prepare('UPDATE escalacoes SET time_id = NULL, eh_suplente_para_time_id = NULL WHERE id = ?').run(
    escalacao.id
  );

  res.json(montarDetalhe(dia.id));
});

// POST /api/dias-baba/:id/escalacoes -> adiciona associado ou convidado no meio do baba
// body: { associado_id? , convidado_nome?, time_id? }  (time_id opcional; se omitido, fica sem time)
router.post('/:id/escalacoes', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const { associado_id, convidado_nome, time_id } = req.body;
  if (!associado_id && !convidado_nome) {
    return res.status(400).json({ erro: 'Informe um associado ou o nome de um convidado.' });
  }

  if (time_id != null) {
    const timeAlvo = db.prepare('SELECT * FROM times_dia WHERE id = ? AND dia_baba_id = ?').get(time_id, dia.id);
    if (!timeAlvo) return res.status(400).json({ erro: 'Time inválido para este Dia de Baba.' });
  }

  if (associado_id) {
    const jaPresente = db
      .prepare('SELECT id FROM escalacoes WHERE dia_baba_id = ? AND associado_id = ?')
      .get(dia.id, associado_id);
    if (jaPresente) return res.status(409).json({ erro: 'Esse associado já está presente neste Dia de Baba.' });

    db.prepare('INSERT INTO escalacoes (dia_baba_id, associado_id, time_id) VALUES (?, ?, ?)').run(
      dia.id,
      associado_id,
      time_id ?? null
    );
  } else {
    db.transaction(() => {
      const conv = db.prepare('INSERT INTO convidados (dia_baba_id, nome) VALUES (?, ?)').run(dia.id, convidado_nome);
      db.prepare('INSERT INTO escalacoes (dia_baba_id, convidado_id, time_id) VALUES (?, ?, ?)').run(
        dia.id,
        conv.lastInsertRowid,
        time_id ?? null
      );
    })();
  }

  res.status(201).json(montarDetalhe(dia.id));
});

// POST /api/dias-baba/:id/times -> cria um time vazio (somente admin)
// Se o baba já estiver rolando, o time novo entra no final da fila.
router.post('/:id/times', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const proximoNumero = db.prepare('SELECT COUNT(*) AS n FROM times_dia WHERE dia_baba_id = ?').get(dia.id).n + 1;

  const novoId = db.transaction(() => {
    const resultado = db
      .prepare('INSERT INTO times_dia (dia_baba_id, nome) VALUES (?, ?)')
      .run(dia.id, `Time ${proximoNumero}`);
    if (dia.baba_iniciado) pushFila(dia.id, resultado.lastInsertRowid);
    return resultado.lastInsertRowid;
  })();

  res.status(201).json(montarDetalhe(dia.id));
  void novoId;
});

// DELETE /api/dias-baba/:id/times/:timeId -> apaga um time que ainda não jogou nenhuma partida
router.delete('/:id/times/:timeId', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const time = db.prepare('SELECT * FROM times_dia WHERE id = ? AND dia_baba_id = ?').get(req.params.timeId, dia.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado.' });

  const jaJogou = db
    .prepare('SELECT COUNT(*) AS n FROM partidas WHERE dia_baba_id = ? AND (time_a_id = ? OR time_b_id = ?)')
    .get(dia.id, time.id, time.id).n;
  if (jaJogou > 0) {
    return res.status(400).json({
      erro: 'Esse time já entrou em alguma partida e não pode ser apagado (isso quebraria o histórico). Remova os jogadores dele um a um, se precisar esvaziá-lo.',
    });
  }

  db.transaction(() => {
    db.prepare(
      'UPDATE escalacoes SET time_id = NULL, eh_suplente_para_time_id = NULL WHERE dia_baba_id = ? AND time_id = ?'
    ).run(dia.id, time.id);
    db.prepare(
      'UPDATE escalacoes SET eh_suplente_para_time_id = NULL WHERE dia_baba_id = ? AND eh_suplente_para_time_id = ?'
    ).run(dia.id, time.id);
    db.prepare('DELETE FROM fila_times WHERE dia_baba_id = ? AND time_id = ?').run(dia.id, time.id);
    db.prepare('DELETE FROM times_dia WHERE id = ?').run(time.id);
  })();

  res.json(montarDetalhe(dia.id));
});


router.post('/:id/iniciar-baba', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  if (dia.baba_iniciado) return res.status(400).json({ erro: 'O baba já foi iniciado.' });

  const times = db.prepare('SELECT id FROM times_dia WHERE dia_baba_id = ? ORDER BY id').all(dia.id);
  if (times.length < 2) {
    return res.status(400).json({ erro: 'Sorteie ao menos 2 times antes de iniciar o baba.' });
  }

  db.transaction(() => {
    const idsTimes = times.map((t) => t.id);
    const primeiro = idsTimes.shift();
    const segundo = idsTimes.shift();

    definirFila(dia.id, idsTimes);

    db.prepare(
      `INSERT INTO partidas (dia_baba_id, time_a_id, time_b_id, gols_time_a, gols_time_b, ordem) VALUES (?, ?, ?, 0, 0, 1)`
    ).run(dia.id, primeiro, segundo);

    db.prepare('UPDATE dias_baba SET baba_iniciado = 1 WHERE id = ?').run(dia.id);
  })();

  res.status(201).json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/partidas/:partidaId/iniciar -> confirma o início do próximo confronto
// Fica um passo antes da tela ao vivo: mostra "Time X x Time Y" e só libera o registro
// de gols depois que o admin confirmar aqui.
router.patch('/:id/partidas/:partidaId/iniciar', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const partida = db
    .prepare('SELECT * FROM partidas WHERE id = ? AND dia_baba_id = ? AND encerrada = 0')
    .get(req.params.partidaId, dia.id);
  if (!partida) return res.status(404).json({ erro: 'Partida não encontrada.' });

  db.prepare('UPDATE partidas SET iniciada = 1 WHERE id = ?').run(partida.id);

  res.json(montarDetalhe(dia.id));
});

// helper: qual time (efetivo) uma escalação está representando nessa partida
function timeEfetivo(escalacao, partida) {
  const candidato = escalacao.eh_suplente_para_time_id ?? escalacao.time_id;
  if (candidato === partida.time_a_id || candidato === partida.time_b_id) return candidato;
  return null;
}

// POST /api/dias-baba/:id/partidas/:partidaId/gol -> registra gol (+ assistência opcional) ao vivo
// body: { escalacao_id, assistencia_escalacao_id? }
router.post('/:id/partidas/:partidaId/gol', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const partida = db
    .prepare('SELECT * FROM partidas WHERE id = ? AND dia_baba_id = ? AND encerrada = 0')
    .get(req.params.partidaId, dia.id);
  if (!partida) return res.status(404).json({ erro: 'Partida ao vivo não encontrada.' });
  if (!partida.iniciada) {
    return res.status(400).json({ erro: 'Inicie a partida antes de registrar um gol.' });
  }

  const { escalacao_id, assistencia_escalacao_id } = req.body;

  const artilheiro = db.prepare('SELECT * FROM escalacoes WHERE id = ? AND dia_baba_id = ?').get(escalacao_id, dia.id);
  if (!artilheiro) return res.status(400).json({ erro: 'Jogador inválido.' });
  const timeDoGol = timeEfetivo(artilheiro, partida);
  if (!timeDoGol) return res.status(400).json({ erro: 'Esse jogador não está em quadra nessa partida.' });

  let assistente = null;
  if (assistencia_escalacao_id != null) {
    assistente = db.prepare('SELECT * FROM escalacoes WHERE id = ? AND dia_baba_id = ?').get(assistencia_escalacao_id, dia.id);
    if (!assistente) return res.status(400).json({ erro: 'Jogador da assistência inválido.' });
    if (timeEfetivo(assistente, partida) !== timeDoGol) {
      return res.status(400).json({ erro: 'A assistência precisa ser de alguém do mesmo time do gol.' });
    }
  }

  db.transaction(() => {
    const coluna = timeDoGol === partida.time_a_id ? 'gols_time_a' : 'gols_time_b';
    db.prepare(`UPDATE partidas SET ${coluna} = ${coluna} + 1 WHERE id = ?`).run(partida.id);
    db.prepare(
      `INSERT INTO eventos_partida (partida_id, escalacao_id, tipo, quantidade) VALUES (?, ?, 'gol', 1)`
    ).run(partida.id, artilheiro.id);
    if (assistente) {
      db.prepare(
        `INSERT INTO eventos_partida (partida_id, escalacao_id, tipo, quantidade) VALUES (?, ?, 'assistencia', 1)`
      ).run(partida.id, assistente.id);
    }
  })();

  res.status(201).json(montarDetalhe(dia.id));
});

// DELETE /api/dias-baba/:id/partidas/:partidaId/eventos/:eventoId -> desfaz um gol/assistência lançado errado
router.delete('/:id/partidas/:partidaId/eventos/:eventoId', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const partida = db
    .prepare('SELECT * FROM partidas WHERE id = ? AND dia_baba_id = ? AND encerrada = 0')
    .get(req.params.partidaId, dia.id);
  if (!partida) return res.status(404).json({ erro: 'Partida ao vivo não encontrada.' });

  const evento = db
    .prepare('SELECT * FROM eventos_partida WHERE id = ? AND partida_id = ?')
    .get(req.params.eventoId, partida.id);
  if (!evento) return res.status(404).json({ erro: 'Evento não encontrado.' });

  db.transaction(() => {
    if (evento.tipo === 'gol') {
      const escalacao = db.prepare('SELECT * FROM escalacoes WHERE id = ?').get(evento.escalacao_id);
      const timeDoGol = timeEfetivo(escalacao, partida);
      if (timeDoGol) {
        const coluna = timeDoGol === partida.time_a_id ? 'gols_time_a' : 'gols_time_b';
        db.prepare(`UPDATE partidas SET ${coluna} = MAX(0, ${coluna} - 1) WHERE id = ?`).run(partida.id);
      }
    }
    db.prepare('DELETE FROM eventos_partida WHERE id = ?').run(evento.id);
  })();

  res.json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/partidas/:partidaId/encerrar -> fecha a partida ao vivo e avança a fila
router.patch('/:id/partidas/:partidaId/encerrar', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const partida = db
    .prepare('SELECT * FROM partidas WHERE id = ? AND dia_baba_id = ? AND encerrada = 0')
    .get(req.params.partidaId, dia.id);
  if (!partida) return res.status(404).json({ erro: 'Partida ao vivo não encontrada.' });

  const nomeDoTime = (timeId) => db.prepare('SELECT nome FROM times_dia WHERE id = ?').get(timeId)?.nome;

  let mensagem = null;

  db.transaction(() => {
    const filaAntes = listaFila(dia.id).map((f) => f.time_id);

    let novoTimeA;
    let novoTimeB;

    if (partida.gols_time_a !== partida.gols_time_b) {
      const vencedor = partida.gols_time_a > partida.gols_time_b ? partida.time_a_id : partida.time_b_id;
      const perdedor = partida.gols_time_a > partida.gols_time_b ? partida.time_b_id : partida.time_a_id;
      pushFila(dia.id, perdedor);
      novoTimeA = vencedor;
      novoTimeB = popFila(dia.id);
    } else {
      const empatados = [partida.time_a_id, partida.time_b_id];
      const esperando = filaAntes.length;

      if (esperando >= 2) {
        const fresco1 = popFila(dia.id);
        const fresco2 = popFila(dia.id);
        const sorteado = Math.random() < 0.5 ? empatados[0] : empatados[1];
        const outro = sorteado === empatados[0] ? empatados[1] : empatados[0];
        pushFila(dia.id, sorteado); // segue à frente do que sobrou da fila
        pushFila(dia.id, outro); // vai para o final
        novoTimeA = fresco1;
        novoTimeB = fresco2;
        mensagem = `O time sorteado para seguir à frente da fila é: ${nomeDoTime(sorteado)}`;
      } else {
        const sorteado = Math.random() < 0.5 ? empatados[0] : empatados[1];
        const outro = sorteado === empatados[0] ? empatados[1] : empatados[0];
        pushFila(dia.id, outro);
        novoTimeA = sorteado;
        novoTimeB = popFila(dia.id);
        mensagem = `O time sorteado para continuar é o: ${nomeDoTime(sorteado)}`;
      }
    }

    const ordem = db.prepare('SELECT COUNT(*) AS n FROM partidas WHERE dia_baba_id = ?').get(dia.id).n + 1;
    const novaPartida = db
      .prepare(
        `INSERT INTO partidas (dia_baba_id, time_a_id, time_b_id, gols_time_a, gols_time_b, ordem) VALUES (?, ?, ?, 0, 0, ?)`
      )
      .run(dia.id, novoTimeA, novoTimeB, ordem);

    db.prepare(
      `UPDATE partidas SET encerrada = 1, encerrada_em = datetime('now'), fila_antes_encerrar = ?,
       partida_seguinte_id = ?, mensagem_desempate = ? WHERE id = ?`
    ).run(JSON.stringify(filaAntes), novaPartida.lastInsertRowid, mensagem, partida.id);
  })();

  const detalhe = montarDetalhe(dia.id);
  res.json({ ...detalhe, mensagem_desempate: mensagem });
});

// PATCH /api/dias-baba/:id/partidas/:partidaId/reabrir -> desfaz o encerramento de uma partida
// Só funciona se a partida seguinte (criada automaticamente) ainda não teve nenhum gol lançado.
router.patch('/:id/partidas/:partidaId/reabrir', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const partida = db
    .prepare('SELECT * FROM partidas WHERE id = ? AND dia_baba_id = ? AND encerrada = 1')
    .get(req.params.partidaId, dia.id);
  if (!partida) return res.status(404).json({ erro: 'Partida encerrada não encontrada.' });

  const seguinte = partida.partida_seguinte_id
    ? db.prepare('SELECT * FROM partidas WHERE id = ?').get(partida.partida_seguinte_id)
    : null;
  if (!seguinte || seguinte.encerrada) {
    return res.status(400).json({ erro: 'Não é possível desfazer: a fila já avançou mais uma vez.' });
  }
  const temEventos = db.prepare('SELECT COUNT(*) AS n FROM eventos_partida WHERE partida_id = ?').get(seguinte.id).n;
  if (temEventos > 0) {
    return res.status(400).json({ erro: 'Não é possível desfazer: a próxima partida já teve gols registrados.' });
  }

  db.transaction(() => {
    // precisa zerar a referência ANTES de apagar a linha, senão a foreign key barra o DELETE
    db.prepare(
      `UPDATE partidas SET encerrada = 0, encerrada_em = NULL, fila_antes_encerrar = NULL,
       partida_seguinte_id = NULL, mensagem_desempate = NULL WHERE id = ?`
    ).run(partida.id);

    db.prepare('DELETE FROM partidas WHERE id = ?').run(seguinte.id);

    const filaAntes = partida.fila_antes_encerrar ? JSON.parse(partida.fila_antes_encerrar) : [];
    definirFila(dia.id, filaAntes);
  })();

  res.json(montarDetalhe(dia.id));
});

// PATCH /api/dias-baba/:id/finalizar -> trava o Dia de Baba definitivamente (somente admin)
router.patch('/:id/finalizar', autenticar, somenteAdmin, (req, res) => {
  const dia = exigirDia(req, res);
  if (!dia) return;
  if (!exigirAberto(dia, res)) return;

  const temTimes = db.prepare('SELECT COUNT(*) AS n FROM times_dia WHERE dia_baba_id = ?').get(dia.id).n;
  if (temTimes === 0) {
    return res.status(400).json({ erro: 'Sorteie os times antes de finalizar o Dia de Baba.' });
  }
  // Só bloqueia se houver uma partida REALMENTE ao vivo (já iniciada). Se o próximo
  // confronto ainda está só pendente (esperando o admin clicar "Iniciar partida"),
  // ele nunca aconteceu de verdade — descarta ele e finaliza o dia normalmente.
  const partidaAoVivo = db
    .prepare('SELECT * FROM partidas WHERE dia_baba_id = ? AND encerrada = 0 AND iniciada = 1')
    .get(dia.id);
  if (partidaAoVivo) {
    return res.status(400).json({ erro: 'Encerre a partida em andamento antes de finalizar o Dia de Baba.' });
  }

  db.transaction(() => {
    const partidaPendente = db
      .prepare('SELECT * FROM partidas WHERE dia_baba_id = ? AND encerrada = 0 AND iniciada = 0')
      .get(dia.id);
    if (partidaPendente) {
      // solta a referência da partida anterior antes de apagar, senão a foreign key barra
      db.prepare('UPDATE partidas SET partida_seguinte_id = NULL WHERE partida_seguinte_id = ?').run(
        partidaPendente.id
      );
      db.prepare('DELETE FROM partidas WHERE id = ?').run(partidaPendente.id);
    }

    db.prepare(
      `UPDATE dias_baba SET status = 'finalizado', finalizado_em = datetime('now') WHERE id = ?`
    ).run(dia.id);
  })();

  res.json(montarDetalhe(dia.id));
});

module.exports = router;
