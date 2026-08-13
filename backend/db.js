// db.js
// Conexão com o banco SQLite + criação das tabelas.
// O banco fica salvo no arquivo "associacao.db" nesta mesma pasta.
//
// Já deixei aqui as tabelas de "rodadas", "times", "escalacoes", "partidas"
// e "eventos_partida" comentadas/preparadas conceitualmente para as próximas
// etapas (sorteio e registro de partidas). Por enquanto só ativamos as
// tabelas que a tela de cadastro precisa: admins e associados.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'associacao.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- ADMINS ----------
// Quem pode cadastrar associados, gerenciar dados, lançar gols/assistências etc.
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
// Membros da associação. Podem logar (telefone + senha) para ver estatísticas.
// posicao: 'linha' | 'goleiro' | 'ambos'  -> usado depois no sorteio dos times
// ativo: usado para "desativar" um associado sem apagar o histórico dele
db.exec(`
  CREATE TABLE IF NOT EXISTS associados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    apelido TEXT,
    telefone TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    posicao TEXT NOT NULL DEFAULT 'linha' CHECK (posicao IN ('linha', 'goleiro', 'ambos')),
    nivel INTEGER,                 -- opcional: usado no futuro para balancear sorteio
    ativo INTEGER NOT NULL DEFAULT 1,  -- 1 = ativo, 0 = desativado (não aparece em novos sorteios)
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    criado_por_admin_id INTEGER REFERENCES admins(id)
  );
`);

// ---------- PRÓXIMAS TABELAS (referência para as próximas etapas) ----------
// Deixo comentado aqui só para você já visualizar o que vem depois.
// Vamos criar de verdade quando chegarmos na etapa de sorteio/partidas.
//
// CREATE TABLE rodadas (
//   id, data, local, modo_sorteio ('5x5' | '4x4_coringa'), status, criado_em
// );
//
// CREATE TABLE times (
//   id, rodada_id, nome  -- ex: "Time 1", recriado a cada rodada
// );
//
// CREATE TABLE escalacoes (
//   id, time_id, associado_id, eh_goleiro_coringa, status ('titular'|'saiu')
// );
//
// CREATE TABLE partidas (
//   id, rodada_id, time_a_id, time_b_id, gols_time_a, gols_time_b, goleiro_coringa_id
// );
//
// CREATE TABLE eventos_partida (
//   id, partida_id, associado_id, time_id, tipo ('gol'|'assistencia'), criado_em
// );
//
// CREATE TABLE presencas (
//   id, associado_id, rodada_id, status ('confirmado'|'ausente_justificado'|'ausente')
// );

module.exports = db;
