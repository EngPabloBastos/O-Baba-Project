require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRoutes = require('./routes/auth');
const adminsRoutes = require('./routes/admins');
const associadosRoutes = require('./routes/associados');
const diasBabaRoutes = require('./routes/diasBaba');
const desempenhosRoutes = require('./routes/desempenhos');

const app = express();

app.use(cors());
app.use(express.json());

// Reinício mensal do status de pagamento
db.garantirStatusPagamentoAtualizado();
setInterval(() => db.garantirStatusPagamentoAtualizado(), 60 * 60 * 1000);

app.use('/api/auth', authRoutes);
app.use('/api/admins', adminsRoutes);
app.use('/api/associados', associadosRoutes);
app.use('/api/dias-baba', diasBabaRoutes);
app.use('/api/desempenhos', desempenhosRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// Serve o build do frontend em produção
const pastaFrontend = path.join(__dirname, 'public');
app.use(express.static(pastaFrontend));

app.get('*', (req, res) => {
  res.sendFile(path.join(pastaFrontend, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend não encontrado (rode "npm run build" no frontend).');
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
