// src/pages/Desempenhos.jsx
// Estatísticas e rankings dos associados (mensal/anual). Disponível para admin
// e associado — ninguém edita nada aqui, tudo vem calculado das partidas.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Cartao, Secao, Titulo } from '../components/ui.jsx';

const TIPOS = [
  { valor: 'pontuacao', rotulo: 'Pontuação', icone: 'military_tech' },
  { valor: 'gols', rotulo: 'Gols', icone: 'sports_soccer' },
  { valor: 'assistencias', rotulo: 'Assistências', icone: 'ads_click' },
  { valor: 'vitorias', rotulo: 'Vitórias', icone: 'emoji_events' },
];

const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CORES_PODIO = ['bg-tertiary-fixed text-on-tertiary-fixed-variant', 'bg-surface-container-high text-on-surface', 'bg-[#e6c199] text-[#5c3a1e]'];

export default function Desempenhos() {
  const { token, usuario } = useAuth();
  const [periodo, setPeriodo] = useState('mensal');
  const [tipo, setTipo] = useState('pontuacao');
  const [ano, setAno] = useState(ANO_ATUAL);
  const [mes, setMes] = useState(MES_ATUAL);
  const [ranking, setRanking] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setCarregando(true);
    setErro('');
    api
      .buscarRanking(token, { tipo, periodo, ano, mes })
      .then((r) => setRanking(r.ranking))
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token, tipo, periodo, ano, mes]);

  const minhaPosicao = ranking.find((r) => r.associado_id === usuario.id);
  const tipoAtual = TIPOS.find((t) => t.valor === tipo);

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="pt-lg">
        <Titulo>Rankings</Titulo>
      </Secao>

      <Secao className="pt-0">
        <div className="flex bg-surface-variant rounded-xl p-1">
          <button
            className={`flex-1 font-label-bold text-label-bold py-sm text-center rounded-lg transition-colors ${
              periodo === 'mensal' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
            onClick={() => setPeriodo('mensal')}
          >
            Mensal
          </button>
          <button
            className={`flex-1 font-label-bold text-label-bold py-sm text-center rounded-lg transition-colors ${
              periodo === 'anual' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
            onClick={() => setPeriodo('anual')}
          >
            Anual
          </button>
        </div>
      </Secao>

      <Secao className="pt-0 flex-row overflow-x-auto no-scrollbar gap-sm">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            onClick={() => setTipo(t.valor)}
            className={`flex items-center gap-1 shrink-0 px-md py-sm rounded-full font-label-bold text-label-sm transition-colors ${
              tipo === t.valor ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icone}</span>
            {t.rotulo}
          </button>
        ))}
      </Secao>

      <Secao className="pt-0 flex-row gap-sm">
        {periodo === 'mensal' && (
          <select
            className="h-11 px-sm rounded-xl bg-surface-container text-on-surface font-body-md flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
          >
            {NOMES_MESES.map((nome, indice) => (
              <option key={nome} value={indice + 1}>
                {nome}
              </option>
            ))}
          </select>
        )}
        <select
          className="h-11 px-sm rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
        >
          {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Secao>

      <Secao className="pt-0">
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      {!carregando && usuario.role === 'associado' && (
        <Secao className="pt-0">
          <Cartao className="bg-primary/5 border border-primary/20 py-sm">
            <p className="text-body-md text-primary text-center">
              {minhaPosicao
                ? `Sua posição no ranking de ${tipoAtual.rotulo.toLowerCase()}: ${minhaPosicao.posicao}º lugar`
                : 'Você ainda não pontuou neste período.'}
            </p>
          </Cartao>
        </Secao>
      )}

      <Secao className="gap-sm">
        {carregando ? (
          <p className="text-body-md text-on-surface-variant">Carregando...</p>
        ) : ranking.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">Nenhuma estatística registrada neste período.</p>
        ) : (
          ranking.map((r) => {
            const souEu = r.associado_id === usuario.id;
            const corPodio = r.posicao <= 3 ? CORES_PODIO[r.posicao - 1] : 'bg-surface-container text-on-surface-variant';
            return (
              <Cartao
                key={r.associado_id}
                className={`flex items-center gap-md ${souEu ? 'border-2 border-primary' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-label-bold shrink-0 ${corPodio}`}>
                  {r.posicao}
                </div>
                <Avatar nome={r.apelido || r.nome} tamanho={40} tom={souEu ? 'verde' : 'neutro'} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-bold text-on-surface truncate">
                    {r.apelido || r.nome}
                    {souEu ? ' (você)' : ''}
                  </span>
                  <span className="text-label-sm text-on-surface-variant">
                    {r.gols}G · {r.assistencias}A · {r.vitorias}V
                  </span>
                </div>
                <span className="font-headline-md text-headline-md text-primary shrink-0">{r[tipo]}</span>
              </Cartao>
            );
          })
        )}
      </Secao>
    </div>
  );
}

