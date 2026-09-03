// src/pages/Perfil.jsx
// Tela que um associado (não-admin) vê ao logar: a própria ficha, sem poder editar
// (edição é feita pelo admin, conforme as regras do backend) — exceto a própria senha.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Campo, Cartao, Etiqueta, Secao, Titulo } from '../components/ui.jsx';

export default function Perfil() {
  const { token } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState('');

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    api.buscarMeuPerfil(token).then(setPerfil).catch((err) => setErro(err.message));
  }, [token]);

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
              <Avatar nome={perfil.apelido || perfil.nome} tamanho={72} tom="verde" />
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
