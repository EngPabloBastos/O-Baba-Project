// src/pages/PerfilJogador.jsx
// Ficha (somente leitura) de outro jogador — mesmas estatísticas do Meu Perfil,
// mas sem a opção de trocar senha, que é só do próprio dono da conta.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Cartao, Etiqueta, Secao, Titulo, BlocoEstatisticas } from '../components/ui.jsx';

export default function PerfilJogador() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, usuario } = useAuth();
  const [associado, setAssociado] = useState(null);
  const [desempenho, setDesempenho] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    // é o próprio usuário logado -> manda pro Meu Perfil, que já tem tudo (inclusive trocar senha)
    if (usuario?.role === 'associado' && Number(id) === usuario.id) {
      navigate('/', { replace: true });
      return;
    }
    setErro('');
    setAssociado(null);
    setDesempenho(null);
    api.buscarAssociado(token, id).then(setAssociado).catch((err) => setErro(err.message));
    api.buscarDesempenhoDoAssociado(token, id, 'geral').then((r) => setDesempenho(r.estatisticas));
  }, [token, id, usuario, navigate]);

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="pt-lg">
        <Titulo>Perfil do jogador</Titulo>
      </Secao>

      <Secao>
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      {associado && (
        <Secao>
          <Cartao className="flex flex-col items-center text-center gap-sm py-lg">
            <Avatar nome={associado.apelido || associado.nome} tamanho={72} tom="verde" />
            <div>
              <p className="font-headline-md text-headline-md text-on-surface">{associado.nome}</p>
              {associado.apelido && <p className="text-body-md text-on-surface-variant">{associado.apelido}</p>}
            </div>
            <p className="text-body-md text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">smartphone</span>
              {associado.telefone}
            </p>

            <div className="flex gap-sm mt-sm">
              <Etiqueta tom={associado.status_pagamento === 'pago' ? 'verde' : 'vermelho'}>
                {associado.status_pagamento === 'pago' ? 'Pago' : 'Não pago'}
              </Etiqueta>
              <Etiqueta tom={associado.ativo ? 'neutro' : 'vermelho'}>
                {associado.ativo ? 'Ativo' : 'Inativo'}
              </Etiqueta>
            </div>

            {desempenho && <BlocoEstatisticas desempenho={desempenho} />}
          </Cartao>
        </Secao>
      )}
    </div>
  );
}
