// db.js
// Conexão com o banco SQLite + criação/migração das tabelas.
// O banco fica salvo no arquivo "associacao.db" nesta mesma pasta.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'associacao.db'));
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
    criado_por_admin_id INTEGER REFERENCES admins(id),
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    finalizado_em TEXT
  );
`);

// Convidados presentes num Dia de Baba específico (não são associados).
db.exec(`
  CREATE TABLE IF NOT EXISTS convidados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    nome TEXT NOT NULL
  );
`);

// Times sorteados dentro de um Dia de Baba (recriados a cada sorteio).
db.exec(`
  CREATE TABLE IF NOT EXISTS times_dia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    nome TEXT NOT NULL
  );
`);

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
db.exec(`
  CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_baba_id INTEGER NOT NULL REFERENCES dias_baba(id) ON DELETE CASCADE,
    time_a_id INTEGER NOT NULL REFERENCES times_dia(id),
    time_b_id INTEGER NOT NULL REFERENCES times_dia(id),
    gols_time_a INTEGER,
    gols_time_b INTEGER,
    ordem INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Gols/assistências individuais dentro de uma partida. quantidade permite lançar
// "2 gols do fulano nessa partida" numa linha só, evitando duplicar registros.
db.exec(`
  CREATE TABLE IF NOT EXISTS eventos_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
    escalacao_id INTEGER NOT NULL REFERENCES escalacoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('gol', 'assistencia')),
    quantidade INTEGER NOT NULL DEFAULT 1
  );
`);

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
