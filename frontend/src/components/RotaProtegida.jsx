// src/components/RotaProtegida.jsx
// Impede acesso a páginas privadas sem login (e, opcionalmente, exige admin).

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RotaProtegida({ children, somenteAdmin = false }) {
  const { isLogado, isAdmin } = useAuth();

  if (!isLogado) return <Navigate to="/login" replace />;
  if (somenteAdmin && !isAdmin) return <Navigate to="/" replace />;

  return children;
}
