// src/App.jsx
// Define todas as rotas da aplicação.

import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';

import Login from './pages/Login.jsx';
import Associados from './pages/Associados.jsx';
import AssociadoForm from './pages/AssociadoForm.jsx';
import Perfil from './pages/Perfil.jsx';
import Admins from './pages/Admins.jsx';
import DiasBaba from './pages/DiasBaba.jsx';
import DiaBabaForm from './pages/DiaBabaForm.jsx';
import DiaBabaDetalhe from './pages/DiaBabaDetalhe.jsx';
import Desempenhos from './pages/Desempenhos.jsx';

export default function App() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  // A tela de login é cheia (sem cabeçalho/navegação inferior).
  if (location.pathname === '/login') {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        {/* Página inicial: admin vê a lista de associados, associado vê o próprio perfil */}
        <Route
          path="/"
          element={
            <RotaProtegida>{isAdmin ? <Associados /> : <Perfil />}</RotaProtegida>
          }
        />

        <Route
          path="/associados/novo"
          element={
            <RotaProtegida somenteAdmin>
              <AssociadoForm />
            </RotaProtegida>
          }
        />

        <Route
          path="/associados/:id"
          element={
            <RotaProtegida somenteAdmin>
              <AssociadoForm />
            </RotaProtegida>
          }
        />

        <Route
          path="/admins"
          element={
            <RotaProtegida somenteAdmin>
              <Admins />
            </RotaProtegida>
          }
        />

        <Route
          path="/dias-baba"
          element={
            <RotaProtegida>
              <DiasBaba />
            </RotaProtegida>
          }
        />

        <Route
          path="/dias-baba/novo"
          element={
            <RotaProtegida somenteAdmin>
              <DiaBabaForm />
            </RotaProtegida>
          }
        />

        <Route
          path="/dias-baba/:id"
          element={
            <RotaProtegida>
              <DiaBabaDetalhe />
            </RotaProtegida>
          }
        />

        <Route
          path="/desempenhos"
          element={
            <RotaProtegida>
              <Desempenhos />
            </RotaProtegida>
          }
        />

        <Route path="*" element={<Login />} />
      </Routes>
    </Layout>
  );
}

