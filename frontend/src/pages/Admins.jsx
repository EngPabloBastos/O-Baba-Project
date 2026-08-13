// src/pages/Admins.jsx
// Lista os admins existentes e permite criar novos (só admin logado acessa essa tela).

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

export default function Admins() {
  const { token } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');

  function carregar() {
    setCarregando(true);
    api
      .listarAdmins(token)
      .then(setAdmins)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [token]);

  async function criarAdmin(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCriando(true);
    try {
      await api.criarAdmin(token, nome, telefone, senha);
      setNome('');
      setTelefone('');
      setSenha('');
      setSucesso('Admin criado com sucesso.');
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="pagina">
      <h1>Administradores</h1>

      <div className="grade-duas-colunas">
        <div>
          <h2>Admins cadastrados</h2>
          {carregando ? (
            <p>Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>{a.telefone}</td>
                    <td>{new Date(a.criado_em).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h2>Novo admin</h2>
          <form onSubmit={criarAdmin} className="formulario cartao">
            <label>
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </label>
            <label>
              Telefone
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
            </label>
            <label>
              Senha (mínimo 6 caracteres)
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={6}
                required
              />
            </label>

            <Alerta tipo="erro">{erro}</Alerta>
            <Alerta tipo="sucesso">{sucesso}</Alerta>

            <button className="btn btn-primario" type="submit" disabled={criando}>
              {criando ? 'Criando...' : 'Criar admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
