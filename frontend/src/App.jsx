// src/App.jsx
// Define todas as rotas da aplicação.

import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';

import Login from './pages/Login.jsx';
import Associados from './pages/Associados.jsx';
import AssociadoForm from './pages/AssociadoForm.jsx';
import Perfil from './pages/Perfil.jsx';
import Admins from './pages/Admins.jsx';

export default function App() {
  const { isAdmin } = useAuth();

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />

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

          <Route path="*" element={<Login />} />
        </Routes>
      </main>
    </>
  );
}
