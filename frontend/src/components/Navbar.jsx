// src/components/Navbar.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isLogado, isAdmin, usuario, logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate('/login');
  }

  if (!isLogado) return null;

  return (
    <header className="navbar">
      <div className="navbar-marca">⚽ Associação de Futebol</div>

      <nav className="navbar-links">
        {isAdmin ? (
          <>
            <Link to="/">Associados</Link>
            <Link to="/associados/novo">Novo associado</Link>
            <Link to="/admins">Admins</Link>
          </>
        ) : (
          <Link to="/">Meu perfil</Link>
        )}
      </nav>

      <div className="navbar-usuario">
        <span>
          {usuario.nome} <small>({isAdmin ? 'admin' : 'associado'})</small>
        </span>
        <button className="btn btn-secundario" onClick={sair}>
          Sair
        </button>
      </div>
    </header>
  );
}
