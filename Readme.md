# ⚽ Baba Manager

> Sistema de gerenciamento de partidas, jogadores e estatísticas para uma associação amadora de futebol.

O **O Baba Manager** é uma aplicação web desenvolvida para uma associação amadora de futebol da qual faço parte.

O projeto surgiu de uma necessidade real: **centralizar a organização das partidas e o acompanhamento do desempenho dos jogadores**, substituindo controles manuais por um sistema onde os participantes podem consultar seus próprios dados e as informações dos jogos.

A aplicação permite registrar partidas, resultados, gols, assistências, vitórias e pontuação dos jogadores, além de gerar rankings e auxiliar na organização dos babas.

---

## 🚀 Funcionalidades

### 👤 Jogadores

- Login individual para os membros da associação
- Perfil individual de cada jogador
- Consulta das próprias estatísticas
- Histórico de desempenho nas partidas

### ⚽ Partidas

- Registro das partidas realizadas
- Registro de placares
- Registro de gols e assistências
- Controle de vitórias e pontuação
- Histórico dos jogos

### 🏆 Rankings e estatísticas

- Ranking dos jogadores
- Pontuação individual
- Quantidade de gols
- Quantidade de assistências
- Número de vitórias
- Estatísticas de desempenho

### 🎲 Organização

- Sorteio dos times
- Definição da ordem das partidas
- Organização das rodadas

---

## 🛠️ Tecnologias

### Frontend

- **React**
- **JavaScript**
- **JSX**
- **CSS**

### Backend

- **Node.js**
- **Express**
- **JavaScript**
- **API REST**
- **JWT** para autenticação

### Banco de dados

- Banco de dados relacional

### Infraestrutura

- **Docker**
- **Git / GitHub**

---

## 📂 Estrutura do projeto

```text
O-Baba-Project/
│
├── backend/
│   ├── lib/
│   ├── middleware/
│   ├── routes/
│   ├── db.js
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
│
├── Dockerfile
├── .dockerignore
└── README.md

