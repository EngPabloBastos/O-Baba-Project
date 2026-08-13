// src/pages/Login.jsx
// Uma única tela de login com abas "Admin" / "Associado".
// Também tem um link pra criar o primeiro admin, caso o banco esteja vazio
// (a rota POST /api/admins só funciona sem token nesse caso específico).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

export default function Login() {
  const [aba, setAba] = useState('admin'); // 'admin' | 'associado' | 'primeiroAdmin'
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const resposta =
        aba === 'admin'
          ? await api.loginAdmin(telefone, senha)
          : await api.loginAssociado(telefone, senha);
      login(resposta.token, resposta.usuario);
      navigate('/');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function criarPrimeiroAdmin(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.criarPrimeiroAdmin(nome, telefone, senha);
      // já cria e loga em seguida, pra não precisar digitar tudo de novo
      const resposta = await api.loginAdmin(telefone, senha);
      login(resposta.token, resposta.usuario);
      navigate('/');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="pagina-central">
      <div className="cartao cartao-login">
        <h1>⚽ Associação de Futebol</h1>

        {aba !== 'primeiroAdmin' && (
          <>
            <div className="abas">
              <button
                className={`aba ${aba === 'admin' ? 'aba-ativa' : ''}`}
                onClick={() => setAba('admin')}
                type="button"
              >
                Admin
              </button>
              <button
                className={`aba ${aba === 'associado' ? 'aba-ativa' : ''}`}
                onClick={() => setAba('associado')}
                type="button"
              >
                Associado
              </button>
            </div>

            <form onSubmit={entrar} className="formulario">
              <label>
                Telefone
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="75999990000"
                  required
                />
              </label>

              <label>
                Senha
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </label>

              <Alerta tipo="erro">{erro}</Alerta>

              <button className="btn btn-primario" type="submit" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="texto-auxiliar">
              Primeiro acesso e ainda não existe nenhum admin?{' '}
              <button className="link" type="button" onClick={() => setAba('primeiroAdmin')}>
                Criar o primeiro admin
              </button>
            </p>
          </>
        )}

        {aba === 'primeiroAdmin' && (
          <>
            <h2>Criar primeiro admin</h2>
            <p className="texto-auxiliar">
              Isso só funciona se ainda não existir nenhum admin cadastrado no backend.
            </p>
            <form onSubmit={criarPrimeiroAdmin} className="formulario">
              <label>
                Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} required />
              </label>
              <label>
                Telefone
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                />
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

              <button className="btn btn-primario" type="submit" disabled={carregando}>
                {carregando ? 'Criando...' : 'Criar e entrar'}
              </button>
            </form>

            <p className="texto-auxiliar">
              <button className="link" type="button" onClick={() => setAba('admin')}>
                Voltar para o login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
