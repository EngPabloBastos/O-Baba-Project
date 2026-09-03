// src/pages/Login.jsx
// Uma única tela de login com abas "Admin" / "Associado".
// Também tem um link pra criar o primeiro admin, caso o banco esteja vazio
// (a rota POST /api/admins só funciona sem token nesse caso específico).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Botao, Campo } from '../components/ui.jsx';
import logo from '../assets/logo.png';

export default function Login() {
  const [aba, setAba] = useState('admin'); // 'admin' | 'associado' | 'primeiroAdmin'
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

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
    <div className="flex flex-col w-full min-h-screen relative overflow-hidden bg-background">
      {/* fundo com grade sutil, decorativo */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
              <path className="text-primary opacity-10" d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect fill="url(#grid)" height="100%" width="100%" />
        </svg>
      </div>

      <div className="flex-1 flex flex-col justify-center px-container-padding py-xl z-10 relative">
        <div className="flex flex-col items-center mb-xl">
          <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden shadow-md mb-md">
            <img src={logo} alt="Baba Manager" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-background text-center tracking-tight">
            Baba Manager
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant text-center mt-xs">
            Seu clube, sua gestão.
          </p>
        </div>

        <div className="bg-surface-container rounded-[24px] p-container-padding shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tertiary" />

          {aba !== 'primeiroAdmin' ? (
            <>
              <div className="flex bg-surface-variant rounded-xl p-1 mb-lg relative">
                <div
                  className="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-surface shadow-sm rounded-lg transition-transform duration-300 ease-out z-0"
                  style={{ transform: aba === 'associado' ? 'translateX(100%)' : 'translateX(0)' }}
                />
                <button
                  className={`flex-1 relative z-10 font-label-bold text-label-bold py-sm text-center rounded-lg transition-colors duration-200 ${
                    aba === 'admin' ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                  onClick={() => setAba('admin')}
                  type="button"
                >
                  Admin
                </button>
                <button
                  className={`flex-1 relative z-10 font-label-bold text-label-bold py-sm text-center rounded-lg transition-colors duration-200 ${
                    aba === 'associado' ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                  onClick={() => setAba('associado')}
                  type="button"
                >
                  Associado
                </button>
              </div>

              <form onSubmit={entrar} className="flex flex-col gap-md">
                <Campo
                  label="Telefone"
                  icone="smartphone"
                  type="tel"
                  autoComplete="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="75999990000"
                  required
                />

                <div className="flex flex-col gap-xs w-full">
                  <span className="font-label-sm text-label-sm text-on-surface-variant ml-1">Senha</span>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-md text-on-surface-variant text-[20px] pointer-events-none">
                      lock
                    </span>
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-surface-container text-on-surface font-body-md text-body-md rounded-xl pl-[44px] pr-[44px] py-[14px] outline-none border-2 border-transparent focus:border-primary transition-colors placeholder:text-on-surface-variant/50"
                    />
                    <button
                      type="button"
                      aria-label="Mostrar senha"
                      onClick={() => setMostrarSenha((v) => !v)}
                      className="absolute right-md text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center w-8 h-8 rounded-full"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {mostrarSenha ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                <Alerta tipo="erro">{erro}</Alerta>

                <Botao variante="primario" tamanho="grande" type="submit" disabled={carregando} className="w-full mt-sm">
                  {carregando ? 'Entrando...' : 'Entrar'}
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Botao>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Criar primeiro admin</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-md">
                Isso só funciona se ainda não existir nenhum admin cadastrado no backend.
              </p>
              <form onSubmit={criarPrimeiroAdmin} className="flex flex-col gap-md">
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

                <Botao variante="primario" tamanho="grande" type="submit" disabled={carregando} className="w-full mt-sm">
                  {carregando ? 'Criando...' : 'Criar e entrar'}
                </Botao>
              </form>

              <button
                className="font-label-bold text-label-bold text-primary mt-md w-full text-center"
                type="button"
                onClick={() => setAba('admin')}
              >
                Voltar para o login
              </button>
            </>
          )}
        </div>

        {aba !== 'primeiroAdmin' && (
          <div className="mt-xl flex flex-col items-center gap-2">
            <p className="font-body-md text-body-md text-on-surface-variant">Primeiro acesso e ainda não existe nenhum admin?</p>
            <button
              className="font-label-bold text-label-bold text-primary px-4 py-2 rounded-full hover:bg-primary/5 active:bg-primary/10 transition-colors"
              type="button"
              onClick={() => setAba('primeiroAdmin')}
            >
              Criar o primeiro admin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

