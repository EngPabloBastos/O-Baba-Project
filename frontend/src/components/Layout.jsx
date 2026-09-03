// src/components/Layout.jsx
// Cabeçalho fixo + navegação inferior (estilo app mobile), usados em toda
// tela autenticada. A tela de login não usa esse layout (é tela cheia).

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.png';

export default function Layout({ children }) {
  const { usuario, isAdmin, logout } = useAuth();
  const location = useLocation();

  const itensNav = [
    { path: '/', label: 'Início', icone: 'dashboard' },
    { path: '/dias-baba', label: 'Dia de Baba', icone: 'sports_soccer' },
    { path: '/desempenhos', label: 'Rankings', icone: 'leaderboard' },
    ...(isAdmin ? [{ path: '/admins', label: 'Admins', icone: 'admin_panel_settings' }] : []),
  ];

  function ativo(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-container-padding flex items-center justify-between max-w-2xl mx-auto">
          <Link to="/" className="flex items-center gap-sm">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm shrink-0">
              <img src={logo} alt="Baba Manager" className="w-full h-full object-cover" />
            </div>
            <span className="font-headline-md text-headline-md text-primary hidden xs:inline">Baba Manager</span>
          </Link>
          <div className="flex items-center gap-sm">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-label-sm font-label-bold text-on-surface truncate max-w-[120px]">{usuario?.nome}</span>
              <span className="text-label-sm text-on-surface-variant">{isAdmin ? 'Admin' : 'Associado'}</span>
            </div>
            <button
              onClick={logout}
              aria-label="Sair"
              className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative w-full pt-16 pb-28 bg-background min-h-screen">
        <div className="max-w-2xl mx-auto">{children}</div>
      </main>

      <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/80 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex justify-between items-center h-20 px-sm max-w-2xl mx-auto">
          {itensNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={ativo(item.path) ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 h-touch-target-min gap-[2px] transition-colors ${
                ativo(item.path) ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <span className={`material-symbols-outlined ${ativo(item.path) ? 'icon-filled' : ''}`}>{item.icone}</span>
              <span className="text-label-sm font-label-sm">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
