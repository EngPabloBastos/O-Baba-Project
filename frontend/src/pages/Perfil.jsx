// src/pages/Perfil.jsx
// Ficha do associado logado, com opção de trocar a própria senha.

import { useEffect, useRef, useState } from 'react';
import { api, urlArquivo } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Campo, Cartao, Etiqueta, Secao, Titulo, BlocoEstatisticas } from '../components/ui.jsx';
import { BlocoConquistas } from '../components/Conquistas.jsx';

export default function Perfil() {
  const { token, usuario } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [desempenho, setDesempenho] = useState(null);
  const [conquistas, setConquistas] = useState(null);
  const [erro, setErro] = useState('');

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const inputFotoRef = useRef(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState('');

  useEffect(() => {
    api.buscarMeuPerfil(token).then(setPerfil).catch((err) => setErro(err.message));
    // periodo 'geral' = totais de toda a carreira, não só do mês/ano atual
    api.buscarMeuDesempenho(token, 'geral').then((r) => setDesempenho(r.estatisticas));
    api.buscarConquistas(token, usuario.id).then(setConquistas);
  }, [token, usuario.id]);

  async function trocarFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!arquivo) return;

    setErroFoto('');
    setEnviandoFoto(true);
    try {
      const { foto_url } = await api.enviarFotoPerfil(token, arquivo);
      setPerfil((atual) => ({ ...atual, foto_url }));
    } catch (err) {
      setErroFoto(err.message);
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function removerFoto() {
    setErroFoto('');
    setEnviandoFoto(true);
    try {
      await api.removerFotoPerfil(token);
      setPerfil((atual) => ({ ...atual, foto_url: null }));
    } catch (err) {
      setErroFoto(err.message);
    } finally {
      setEnviandoFoto(false);
    }
  }

  function limparFormularioSenha() {
    setSenhaAtual('');
    setSenhaNova('');
    setConfirmarSenha('');
  }

  async function trocarSenha(e) {
    e.preventDefault();
    setErroSenha('');
    setSucessoSenha('');

    if (senhaNova !== confirmarSenha) {
      setErroSenha('A nova senha e a confirmação não são iguais.');
      return;
    }

    setSalvandoSenha(true);
    try {
      await api.trocarMinhaSenha(token, senhaAtual, senhaNova);
      setSucessoSenha('Senha alterada com sucesso.');
      limparFormularioSenha();
    } catch (err) {
      setErroSenha(err.message);
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="pt-lg">
        <Titulo>Meu perfil</Titulo>
      </Secao>

      <Secao>
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      {perfil && (
        <>
          <Secao>
            <Cartao className="flex flex-col items-center text-center gap-sm py-lg">
              <div className="relative">
                <Avatar nome={perfil.apelido || perfil.nome} foto={urlArquivo(perfil.foto_url)} tamanho={88} tom="verde" />
                <button
                  onClick={() => inputFotoRef.current?.click()}
                  disabled={enviandoFoto}
                  title="Trocar foto"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                </button>
                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={trocarFoto}
                />
              </div>
              {perfil.foto_url && (
                <button
                  onClick={removerFoto}
                  disabled={enviandoFoto}
                  className="text-label-sm text-on-surface-variant underline disabled:opacity-50"
                >
                  Remover foto
                </button>
              )}
              <Alerta tipo="erro">{erroFoto}</Alerta>
              <div>
                <p className="font-headline-md text-headline-md text-on-surface">{perfil.nome}</p>
                {perfil.apelido && <p className="text-body-md text-on-surface-variant">{perfil.apelido}</p>}
              </div>
              <p className="text-body-md text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">smartphone</span>
                {perfil.telefone}
              </p>

              <div className="flex gap-sm mt-sm">
                <Etiqueta tom={perfil.status_pagamento === 'pago' ? 'verde' : 'vermelho'}>
                  {perfil.status_pagamento === 'pago' ? 'Pago' : 'Não pago'}
                </Etiqueta>
                <Etiqueta tom={perfil.ativo ? 'neutro' : 'vermelho'}>{perfil.ativo ? 'Ativo' : 'Inativo'}</Etiqueta>
              </div>

            </Cartao>
          </Secao>

          {/* Conquistas primeiro (destaque), depois as estatísticas */}
          <Secao>
            <BlocoConquistas conquistas={conquistas} />
            <BlocoEstatisticas desempenho={desempenho} />

            <p className="text-label-sm text-on-surface-variant text-center px-md">
              Precisa corrigir algum dado ou já pagou e o status não mudou? Fale com um administrador da
              associação.
            </p>
          </Secao>

          <Secao>
            <Botao
              variante="secundario"
              tamanho="pequeno"
              onClick={() => {
                setMostrarSenha((v) => !v);
                setErroSenha('');
                setSucessoSenha('');
                limparFormularioSenha();
              }}
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              {mostrarSenha ? 'Fechar' : 'Alterar minha senha'}
            </Botao>

            {mostrarSenha && (
              <Cartao>
                <form onSubmit={trocarSenha} className="flex flex-col gap-md">
                  <Campo
                    label="Senha atual"
                    icone="lock"
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    required
                  />
                  <Campo
                    label="Nova senha (mínimo 6 caracteres)"
                    icone="key"
                    type="password"
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                    minLength={6}
                    required
                  />
                  <Campo
                    label="Confirmar nova senha"
                    icone="key"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    minLength={6}
                    required
                  />

                  <Alerta tipo="erro">{erroSenha}</Alerta>
                  <Alerta tipo="sucesso">{sucessoSenha}</Alerta>

                  <Botao variante="primario" type="submit" disabled={salvandoSenha}>
                    {salvandoSenha ? 'Salvando...' : 'Salvar nova senha'}
                  </Botao>
                </form>
              </Cartao>
            )}
          </Secao>
        </>
      )}
    </div>
  );
}
