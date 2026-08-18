// server.js
// Ponto de entrada do backend. Roda com: npm start

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRoutes = require('./routes/auth');
const adminsRoutes = require('./routes/admins');
const associadosRoutes = require('./routes/associados');
const diasBabaRoutes = require('./routes/diasBaba');
const desempenhosRoutes = require('./routes/desempenhos');

const app = express();

app.use(cors()); // libera acesso do front-end (React) que vai rodar em outra porta/domínio
app.use(express.json());

// Garante que o status de pagamento já está atualizado assim que o servidor sobe
// (cobre o caso de o servidor ter ficado desligado durante a virada do mês),
// e depois confere de novo a cada hora para pegar a virada do dia 1 certinho.
db.garantirStatusPagamentoAtualizado();
setInterval(() => db.garantirStatusPagamentoAtualizado(), 60 * 60 * 1000);

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminsRoutes);
app.use('/api/associados', associadosRoutes);
app.use('/api/dias-baba', diasBabaRoutes);
app.use('/api/desempenhos', desempenhosRoutes);

// Rota simples pra checar se o servidor está de pé
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Tratamento de rota não encontrada
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// Tratamento de erro genérico (evita o servidor quebrar silenciosamente)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
