import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';

// Aplica o tema salvo (ou o do sistema, se nunca escolheu) ANTES de desenhar
// a tela, pra não piscar claro-depois-escuro na primeira renderização.
const temaSalvo = localStorage.getItem('tema');
const prefereEscuroNoSistema = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (temaSalvo === 'escuro' || (!temaSalvo && prefereEscuroNoSistema)) {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
