// src/context/AuthContext.jsx
// Guarda quem está logado (token + dados do usuário) e deixa isso
// disponível pra qualquer componente através do hook useAuth().
// Salva no localStorage pra não precisar logar de novo a cada F5.

import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const salvo = localStorage.getItem('auth');
    return salvo ? JSON.parse(salvo) : null;
  });

  function login(token, usuario) {
    const novo = { token, usuario };
    localStorage.setItem('auth', JSON.stringify(novo));
    setAuth(novo);
  }

  function logout() {
    localStorage.removeItem('auth');
    setAuth(null);
  }

  const value = {
    token: auth?.token ?? null,
    usuario: auth?.usuario ?? null,
    isAdmin: auth?.usuario?.role === 'admin',
    isLogado: !!auth,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
