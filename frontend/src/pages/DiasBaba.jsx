// src/pages/DiasBaba.jsx
// Histórico dos Dias de Baba.

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

  async function excluirDia(dia) {
    const dataFormatada = new Date(`${dia.data}T00:00:00`).toLocaleDateString('pt-BR');
    const senha = window.prompt(
      `Pra apagar o Dia de Baba de ${dataFormatada}, digite a senha de confirmação:`
    );
    if (senha === null) return; // cancelou
    setErro('');
    try {
      await api.excluirDiaBaba(token, dia.id, senha);
      setDias((atual) => atual.filter((d) => d.id !== dia.id));
    } catch (err) {
      setErro(err.message);
    }
  }

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
          dias.map((d, i) => (
            <Cartao
              key={d.id}
              className={`flex items-start justify-between gap-md ${i === 0 ? 'border-l-4 border-l-primary' : ''}`}
            >
              <Link
                to={`/dias-baba/${d.id}`}
                className="flex flex-col gap-sm min-w-0 flex-1 transition-transform active:scale-[0.98]"
              >
                {i === 0 && (
                  <span className="font-label-bold text-label-sm text-primary uppercase tracking-[0.12em]">
                    Mais recente
                  </span>
                )}
                <span className="font-headline-md text-[18px] leading-tight text-on-surface">
                  {new Date(`${d.data}T00:00:00`).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <div className="flex flex-wrap gap-xs">
                  {[d.formato || 'Sem formato', `${d.total_presentes} presentes`, `${d.total_partidas} partidas`].map(
                    (texto) => (
                      <span
                        key={texto}
                        className="bg-surface-container text-on-surface-variant rounded-full px-sm py-[3px] text-label-sm"
                      >
                        {texto}
                      </span>
                    )
                  )}
                </div>
              </Link>
              <div className="flex flex-col items-end gap-sm shrink-0">
                <Etiqueta tom={d.status === 'aberto' ? 'amarelo' : 'neutro'}>
                  {d.status === 'aberto' ? 'Em andamento' : 'Finalizado'}
                </Etiqueta>
                {isAdmin && (
                  <button
                    onClick={() => excluirDia(d)}
                    title="Apagar Dia de Baba"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-error hover:bg-error/10 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                )}
              </div>
            </Cartao>
          ))
        )}
      </Secao>
    </div>
  );
}

