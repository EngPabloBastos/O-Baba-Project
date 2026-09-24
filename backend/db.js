// db.js
// Conexão com o banco SQLite + criação/migração das tabelas.
// O banco fica salvo no arquivo "associacao.db" nesta mesma pasta.

const Database = require('better-sqlite3');
const path = require('path');

// DB_PATH permite apontar o banco para fora da pasta do código (ex: um volume
// montado no Docker/EasyPanel), o que evita perder os dados a cada novo deploy.
// Se não for definido, usa o mesmo arquivo de sempre (bom para rodar local).
const caminhoBanco = process.env.DB_PATH || path.join(__dirname, 'associacao.db');
const db = new Database(caminhoBanco);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- ADMINS ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- ASSOCIADOS ----------
// status_pagamento: 'pago' | 'nao_pago'. Reiniciado para 'nao_pago' automaticamente
// no dia 1 de cada mês (ver garantirStatusPagamentoAtualizado, chamada no boot e periodicamente).
db.exec(`
  CREATE TABLE IF NOT EXISTS associados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    apelido TEXT,
    telefone TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    status_pagamento TEXT NOT NULL DEFAULT 'nao_pago' CHECK (status_pagamento IN ('pago', 'nao_pago')),
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    criado_por_admin_id INTEGER REFERENCES admins(id)
  );
`);

// Migração: bancos antigos tinham as colunas "posicao" e "nivel" (removidas do produto)
// e não tinham "status_pagamento". Ajusta um banco já existente sem perder dados.
const colunasAssociados = db.prepare('PRAGMA table_info(associados)').all().map((c) => c.name);
if (!colunasAssociados.includes('status_pagamento')) {
  db.exec(`ALTER TABLE associados ADD COLUMN status_pagamento TEXT NOT NULL DEFAULT 'nao_pago'`);
}
for (const coluna of ['posicao', 'nivel']) {
  if (colunasAssociados.includes(coluna)) {
    try {
      db.exec(`ALTER TABLE associados DROP COLUMN ${coluna}`);
    } catch {
      // SQLite antigo sem suporte a DROP COLUMN: ignora, a coluna só fica sem uso.
    }
  }
}

// ---------- CONFIGURAÇÕES INTERNAS ----------
// Guarda coisas como o último mês em que o status de pagamento foi reiniciado,
// para não depender do servidor ficar ligado exatamente à meia-noite do dia 1.
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  );
`);

// ---------- DIAS DE BABA ----------
// status: 'aberto' (em andamento, tudo editável) | 'finalizado' (histórico travado)
// formato só é definido no momento do sorteio dos times ('4x4' | '5x5').
db.exec(`
  CREATE TABLE IF NOT EXISTS dias_baba (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    formato TEXT CHECK (formato IN ('4x4', '5x5')),
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'finalizado')),
    baba_iniciado INTEGER NOT NULL DEFAULT 0,
    criado_por_admin_id INTEGER REFERENCES admins(id),
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    finalizado_em TEXT
  );
`);
{
  const colunasDia = db.prepare('PRAGMA table_info(dias_baba)').all().map((c) => c.name);
  if (!colunasDia.includes('baba_iniciado')) {
    db.exec(`ALTER TABLE dias_baba ADD COLUMN baba_iniciado INTEGER NOT NULL DEFAULT 0`);
  }
}

// Convidados presentes num Dia de Baba específico (não são associados).
db.exec(`
  CREATE TABLE IF NOT EXISTS convidados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    nome TEXT NOT NULL
  );
`);

// Times sorteados dentro de um Dia de Baba (recriados a cada sorteio).
// ativo=0 significa "dissolvido" (ex: todo mundo saiu) — a linha continua existindo
// pra não quebrar o histórico de partidas antigas que já referenciam esse time,
// só para de aparecer como opção pra jogar/receber gente nova.
db.exec(`
  CREATE TABLE IF NOT EXISTS times_dia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1
  );
`);
{
  const colunasTime = db.prepare('PRAGMA table_info(times_dia)').all().map((c) => c.name);
  if (!colunasTime.includes('ativo')) {
    db.exec(`ALTER TABLE times_dia ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1`);
  }
}

// Escalação: cada jogador presente (associado OU convidado) e o time a que pertence
// naquele Dia de Baba. eh_suplente_para_time_id: se preenchido, esse jogador,
// mantendo seu time original em time_id, também joga como suplente pelo time indicado.
db.exec(`
  CREATE TABLE IF NOT EXISTS escalacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    time_id INTEGER REFERENCES times_dia(id),
    associado_id INTEGER REFERENCES associados(id),
    convidado_id INTEGER REFERENCES convidados(id),
    eh_suplente_para_time_id INTEGER REFERENCES times_dia(id),
    CHECK ((associado_id IS NOT NULL AND convidado_id IS NULL) OR (associado_id IS NULL AND convidado_id IS NOT NULL))
  );
`);

// Partidas (confrontos) realizadas dentro de um Dia de Baba entre dois times sorteados.
// O motor de fila cria as partidas automaticamente (a primeira ao "Iniciar Baba",
// as seguintes ao encerrar a anterior) — o admin não escolhe manualmente quem
// joga contra quem. gols_time_a/gols_time_b começam em 0 e sobem em tempo real
// conforme os gols são registrados; "encerrada" marca quando o admin fechou o
// placar daquele confronto (o que também dispara o avanço da fila).
db.exec(`
  CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    time_a_id INTEGER NOT NULL REFERENCES times_dia(id),
    time_b_id INTEGER NOT NULL REFERENCES times_dia(id),
    gols_time_a INTEGER NOT NULL DEFAULT 0,
    gols_time_b INTEGER NOT NULL DEFAULT 0,
    ordem INTEGER NOT NULL DEFAULT 1,
    iniciada INTEGER NOT NULL DEFAULT 0,
    encerrada INTEGER NOT NULL DEFAULT 0,
    encerrada_em TEXT,
    fila_antes_encerrar TEXT,
    partida_seguinte_id INTEGER REFERENCES partidas(id),
    mensagem_desempate TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
{
  const colunasPartida = db.prepare('PRAGMA table_info(partidas)').all().map((c) => c.name);
  const novasColunas = {
    iniciada: `ALTER TABLE partidas ADD COLUMN iniciada INTEGER NOT NULL DEFAULT 0`,
    encerrada: `ALTER TABLE partidas ADD COLUMN encerrada INTEGER NOT NULL DEFAULT 0`,
    encerrada_em: `ALTER TABLE partidas ADD COLUMN encerrada_em TEXT`,
    fila_antes_encerrar: `ALTER TABLE partidas ADD COLUMN fila_antes_encerrar TEXT`,
    partida_seguinte_id: `ALTER TABLE partidas ADD COLUMN partida_seguinte_id INTEGER REFERENCES partidas(id)`,
    mensagem_desempate: `ALTER TABLE partidas ADD COLUMN mensagem_desempate TEXT`,
  };
  for (const [coluna, sql] of Object.entries(novasColunas)) {
    if (!colunasPartida.includes(coluna)) db.exec(sql);
  }
  // bancos criados antes do DEFAULT 0 existir podem ter ficado com gols NULL
  db.exec(`UPDATE partidas SET gols_time_a = 0 WHERE gols_time_a IS NULL`);
  db.exec(`UPDATE partidas SET gols_time_b = 0 WHERE gols_time_b IS NULL`);
}

// Fila de times aguardando para jogar (formato "vencedor fica"). Só existe
// depois que o admin clica em "Iniciar Baba". Os dois times da partida ao vivo
// NÃO estão nesta tabela — só entram aqui de novo se perderem ou empatarem.
db.exec(`
  CREATE TABLE IF NOT EXISTS fila_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    time_id INTEGER NOT NULL REFERENCES times_dia(id),
    posicao INTEGER NOT NULL
  );
`);

// Gols/assistências individuais dentro de uma partida. quantidade permite lançar
// "2 gols do fulano nessa partida" numa linha só, evitando duplicar registros.
// "gol_contra" marca no placar do adversário, mas nunca soma na estatística do jogador.
db.exec(`
  CREATE TABLE IF NOT EXISTS eventos_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
    escalacao_id INTEGER NOT NULL REFERENCES escalacoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('gol', 'assistencia', 'gol_contra')),
    quantidade INTEGER NOT NULL DEFAULT 1
  );
`);
{
  const definicaoAtual = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'eventos_partida'`).get();
  if (definicaoAtual && !definicaoAtual.sql.includes('gol_contra')) {
    db.exec(`
      ALTER TABLE eventos_partida RENAME TO eventos_partida_antiga;
      CREATE TABLE eventos_partida (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
        escalacao_id INTEGER NOT NULL REFERENCES escalacoes(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL CHECK (tipo IN ('gol', 'assistencia', 'gol_contra')),
        quantidade INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO eventos_partida SELECT * FROM eventos_partida_antiga;
      DROP TABLE eventos_partida_antiga;
    `);
  }
}

// ---------- VITÓRIAS POR PARTIDA ----------
// Registra, no momento em que uma partida é encerrada, quais escalações (jogadores)
// venceram aquele confronto específico. Isso substitui o cálculo antigo, que olhava
// o time_id ATUAL do jogador na hora de somar as estatísticas: se alguém trocasse de
// time depois (ex: João jogou pelo Time 5, que perdeu tudo, e depois é movido pro
// Time 2), ele acabava herdando as vitórias do Time 2 sem ter jogado por ele. Agora
// a vitória fica fixada nos jogadores certos desde a hora que a partida terminou.
db.exec(`
  CREATE TABLE IF NOT EXISTS vitorias_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
    escalacao_id INTEGER NOT NULL REFERENCES escalacoes(id) ON DELETE CASCADE
  );
`);

// Migração: preenche vitorias_partida para partidas encerradas antes dessa tabela
// existir, usando a composição de time atual de cada jogador — é a melhor informação
// disponível, já que o time exato de cada partida antiga não ficava guardado. Roda só
// uma vez (a tabela nasce vazia); daqui pra frente cada partida grava sua vitória no
// momento certo, então trocas de time futuras não afetam mais o histórico.
if (db.prepare('SELECT COUNT(*) AS n FROM vitorias_partida').get().n === 0) {
  const partidasComVencedor = db
    .prepare(`SELECT * FROM partidas WHERE encerrada = 1 AND gols_time_a <> gols_time_b`)
    .all();
  const inserirVitoriaMigracao = db.prepare(
    'INSERT INTO vitorias_partida (partida_id, escalacao_id) VALUES (?, ?)'
  );
  for (const partida of partidasComVencedor) {
    const timeVencedor = partida.gols_time_a > partida.gols_time_b ? partida.time_a_id : partida.time_b_id;
    const escalacoesVencedoras = db
      .prepare(
        `SELECT id FROM escalacoes
         WHERE dia_baba_id = ? AND associado_id IS NOT NULL
           AND (time_id = ? OR eh_suplente_para_time_id = ?)`
      )
      .all(partida.dia_baba_id, timeVencedor, timeVencedor);
    for (const esc of escalacoesVencedoras) {
      inserirVitoriaMigracao.run(partida.id, esc.id);
    }
  }
}

// ---------- Reinício mensal do status de pagamento ----------
// No dia 1 de cada mês (primeira vez que o servidor checa depois disso),
// todo associado volta para "nao_pago". Guardamos o último mês já processado
// em `config` para não repetir o reset e para funcionar mesmo se o servidor
// ficar desligado no exato instante da virada do mês.
function garantirStatusPagamentoAtualizado() {
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const linha = db.prepare(`SELECT valor FROM config WHERE chave = 'ultimo_mes_reset_pagamento'`).get();
  const ultimoMesProcessado = linha?.valor;

  if (ultimoMesProcessado !== mesAtual) {
    db.prepare(`UPDATE associados SET status_pagamento = 'nao_pago'`).run();
    db.prepare(
      `INSERT INTO config (chave, valor) VALUES ('ultimo_mes_reset_pagamento', ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
    ).run(mesAtual);
  }
}

module.exports = db;
module.exports.garantirStatusPagamentoAtualizado = garantirStatusPagamentoAtualizado;
