// src/pages/DiasBaba.jsx
// Histórico de todos os Dias de Baba já criados. Visível para admin e associado;
// só o admin vê o botão de criar um novo.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Botao, Cartao, Etiqueta, Secao, Titulo } from '../components/ui.jsx';

export default function DiasBaba() {
  const { token, isAdmin } = useAuth();
  const [dias, setDias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .listarDiasBaba(token)
      .then(setDias)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token]);

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="flex-row items-center justify-between pt-lg">
        <Titulo>Dia de Baba</Titulo>
        {isAdmin && (
          <Link to="/dias-baba/novo">
            <Botao tamanho="pequeno">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Novo
            </Botao>
          </Link>
        )}
      </Secao>

      <Secao>
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      <Secao className="gap-sm">
        {carregando ? (
          <p className="text-body-md text-on-surface-variant">Carregando...</p>
        ) : dias.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">Nenhum Dia de Baba registrado ainda.</p>
        ) : (
          dias.map((d) => (
            <Link key={d.id} to={`/dias-baba/${d.id}`}>
              <Cartao className="flex items-center justify-between gap-md transition-transform active:scale-[0.98]">
                <div className="flex items-center gap-md min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-container/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">sports_soccer</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-bold text-on-surface">
                      {new Date(`${d.data}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">
                      {d.formato || 'sem formato'} · {d.total_presentes} presentes · {d.total_partidas} partidas
                    </span>
                  </div>
                </div>
                <Etiqueta tom={d.status === 'aberto' ? 'amarelo' : 'neutro'}>
                  {d.status === 'aberto' ? 'Em andamento' : 'Finalizado'}
                </Etiqueta>
              </Cartao>
            </Link>
          ))
        )}
      </Secao>
    </div>
  );
}

