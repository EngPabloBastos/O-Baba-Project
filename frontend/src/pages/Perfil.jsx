// src/pages/Perfil.jsx
// Tela que um associado (não-admin) vê ao logar: a própria ficha, sem poder editar
// (edição é feita pelo admin, conforme as regras do backend).

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Cartao, Etiqueta, Secao, Titulo } from '../components/ui.jsx';

export default function Perfil() {
  const { token } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.buscarMeuPerfil(token).then(setPerfil).catch((err) => setErro(err.message));
  }, [token]);

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="pt-lg">
        <Titulo>Meu perfil</Titulo>
      </Secao>

      <Secao>
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      {perfil && (
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
      )}
    </div>
  );
}

