// server.js
// Ponto de entrada do backend. Roda com: npm start
// Também serve o build do frontend (pasta "public") em produção, para que
// backend e frontend rodem juntos como um único serviço (útil em VPS/EasyPanel).

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

app.use(cors()); // libera acesso do front-end quando ele roda em outra porta/domínio (ex: npm run dev)
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

// 404 apenas para chamadas de API que não bateram em nenhuma rota acima
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// Serve o build do frontend (gerado por "npm run build" dentro de frontend/,
// copiado para esta pasta "public" — ver Dockerfile). Se essa pasta não existir
// (ex: rodando só o backend em desenvolvimento), isso simplesmente não serve nada.
const pastaFrontend = path.join(__dirname, 'public');
app.use(express.static(pastaFrontend));

// Qualquer outra rota GET cai no index.html, pra o React Router cuidar da navegação
// (ex: recarregar a página em /dias-baba/3 direto no navegador).
app.get('*', (req, res) => {
  res.sendFile(path.join(pastaFrontend, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend não encontrado (rode "npm run build" no frontend).');
  });
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
