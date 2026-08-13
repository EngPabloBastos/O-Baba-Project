// src/pages/Perfil.jsx
// Tela que um associado (não-admin) vê ao logar: a própria ficha, sem poder editar
// (edição é feita pelo admin, conforme as regras do backend).

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

const POSICAO_LABEL = { linha: 'Linha', goleiro: 'Goleiro', ambos: 'Ambos' };

export default function Perfil() {
  const { token } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.buscarMeuPerfil(token).then(setPerfil).catch((err) => setErro(err.message));
  }, [token]);

  return (
    <div className="pagina pagina-central">
      <h1>Meu perfil</h1>
      <Alerta tipo="erro">{erro}</Alerta>

      {perfil && (
        <div className="cartao ficha">
          <div className="ficha-linha">
            <strong>Nome:</strong> {perfil.nome}
          </div>
          {perfil.apelido && (
            <div className="ficha-linha">
              <strong>Apelido:</strong> {perfil.apelido}
            </div>
          )}
          <div className="ficha-linha">
            <strong>Telefone:</strong> {perfil.telefone}
          </div>
          <div className="ficha-linha">
            <strong>Posição:</strong> {POSICAO_LABEL[perfil.posicao] || perfil.posicao}
          </div>
          {perfil.nivel != null && (
            <div className="ficha-linha">
              <strong>Nível:</strong> {perfil.nivel}
            </div>
          )}
          <div className="ficha-linha">
            <strong>Status:</strong>{' '}
            <span className={`etiqueta ${perfil.ativo ? 'etiqueta-ativo' : 'etiqueta-inativo'}`}>
              {perfil.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="texto-auxiliar">
            Precisa corrigir algum dado? Fale com um administrador da associação.
          </p>
        </div>
      )}
    </div>
  );
}
