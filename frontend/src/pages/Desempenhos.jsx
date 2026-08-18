// src/pages/Desempenhos.jsx
// Estatísticas e rankings dos associados (mensal/anual). Disponível para admin
// e associado — ninguém edita nada aqui, tudo vem calculado das partidas.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

const TIPOS = [
  { valor: 'pontuacao', rotulo: 'Pontuação' },
  { valor: 'gols', rotulo: 'Gols' },
  { valor: 'assistencias', rotulo: 'Assistências' },
  { valor: 'vitorias', rotulo: 'Vitórias' },
];

const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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

  return (
    <div className="pagina">
      <h1>Desempenhos</h1>

      <div className="abas">
        <button className={`aba ${periodo === 'mensal' ? 'aba-ativa' : ''}`} onClick={() => setPeriodo('mensal')}>
          Mensal
        </button>
        <button className={`aba ${periodo === 'anual' ? 'aba-ativa' : ''}`} onClick={() => setPeriodo('anual')}>
          Anual
        </button>
      </div>

      <div className="filtros" style={{ marginTop: '0.8rem' }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              Ranking de {t.rotulo}
            </option>
          ))}
        </select>

        {periodo === 'mensal' && (
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {NOMES_MESES.map((nome, indice) => (
              <option key={nome} value={indice + 1}>
                {nome}
              </option>
            ))}
          </select>
        )}

        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <Alerta tipo="erro">{erro}</Alerta>

      {!carregando && usuario.role === 'associado' && (
        <p className="texto-auxiliar" style={{ marginTop: '0.6rem' }}>
          {minhaPosicao
            ? `Sua posição no ranking de ${TIPOS.find((t) => t.valor === tipo).rotulo.toLowerCase()}: ${minhaPosicao.posicao}º lugar.`
            : 'Você ainda não pontuou neste período.'}
        </p>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : ranking.length === 0 ? (
        <p className="texto-auxiliar">Nenhuma estatística registrada neste período.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Associado</th>
              <th>Gols</th>
              <th>Assistências</th>
              <th>Vitórias</th>
              <th>Pontuação</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.associado_id} style={r.associado_id === usuario.id ? { fontWeight: 700 } : undefined}>
                <td>{r.posicao}º</td>
                <td>{r.apelido || r.nome}</td>
                <td>{r.gols}</td>
                <td>{r.assistencias}</td>
                <td>{r.vitorias}</td>
                <td>{r.pontuacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
