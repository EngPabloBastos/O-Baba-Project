// src/pages/Admins.jsx
// Lista os admins existentes e permite criar novos (só admin logado acessa essa tela).

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Campo, Cartao, Secao, Titulo } from '../components/ui.jsx';

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
    <div className="flex flex-col w-full pb-20">
      <Secao className="pt-lg">
        <Titulo>Administradores</Titulo>
      </Secao>

      <Secao>
        <h2 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
          Admins cadastrados
        </h2>
        {carregando ? (
          <p className="text-body-md text-on-surface-variant">Carregando...</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {admins.map((a) => (
              <Cartao key={a.id} className="flex items-center gap-md">
                <Avatar nome={a.nome} tamanho={44} tom="cinza" />
                <div className="flex flex-col min-w-0">
                  <span className="font-label-bold text-on-surface truncate">{a.nome}</span>
                  <span className="text-label-sm text-on-surface-variant">
                    {a.telefone} · desde {new Date(a.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </Cartao>
            ))}
          </div>
        )}
      </Secao>

      <Secao>
        <h2 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
          Novo admin
        </h2>
        <Cartao>
          <form onSubmit={criarAdmin} className="flex flex-col gap-md">
            <Campo label="Nome" icone="person" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Campo
              label="Telefone"
              icone="smartphone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
            <Campo
              label="Senha (mínimo 6 caracteres)"
              icone="lock"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={6}
              required
            />

            <Alerta tipo="erro">{erro}</Alerta>
            <Alerta tipo="sucesso">{sucesso}</Alerta>

            <Botao variante="primario" type="submit" disabled={criando}>
              {criando ? 'Criando...' : 'Criar admin'}
            </Botao>
          </form>
        </Cartao>
      </Secao>
    </div>
  );
}

