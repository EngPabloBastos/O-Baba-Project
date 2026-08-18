// src/pages/DiaBabaDetalhe.jsx
// Tela central de um Dia de Baba: sorteio dos times, suplentes, registro de
// partidas (placar + gols + assistências) e finalização (trava o histórico).
// Admin vê tudo editável enquanto o dia está "aberto"; associado (e admin
// depois de finalizado) vê tudo em modo leitura.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

export default function DiaBabaDetalhe() {
  const { id } = useParams();
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [dia, setDia] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [formato, setFormato] = useState('5x5');

  const carregar = useCallback(() => {
    return api
      .buscarDiaBaba(token, id)
      .then(setDia)
      .catch((err) => setErro(err.message));
  }, [token, id]);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  async function sortear(e) {
    e.preventDefault();
    setErro('');
    try {
      await api.sortearTimes(token, id, formato);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function finalizar() {
    const confirmar = window.confirm(
      'Finalizar este Dia de Baba? Depois de finalizado, times, suplentes, partidas, gols, assistências e vitórias não poderão mais ser alterados.'
    );
    if (!confirmar) return;
    try {
      await api.finalizarDiaBaba(token, id);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  if (carregando) return <p className="pagina">Carregando...</p>;
  if (!dia) return <p className="pagina">{erro || 'Dia de Baba não encontrado.'}</p>;

  const editavel = isAdmin && dia.status === 'aberto';
  const temTimes = dia.times.length > 0;

  return (
    <div className="pagina">
      <div className="cabecalho-pagina">
        <div>
          <h1>Dia de Baba — {new Date(`${dia.data}T00:00:00`).toLocaleDateString('pt-BR')}</h1>
          <span className={`etiqueta etiqueta-${dia.status}`}>
            {dia.status === 'aberto' ? 'Em andamento' : 'Finalizado'}
          </span>{' '}
          {dia.formato && <span className="texto-auxiliar">formato {dia.formato}</span>}
        </div>
        <button className="btn btn-secundario btn-pequeno" onClick={() => navigate('/dias-baba')}>
          Voltar ao histórico
        </button>
      </div>

      <Alerta tipo="erro">{erro}</Alerta>

      {!temTimes && (
        <div className="cartao">
          <h2>Presentes ({dia.presentes.length})</h2>
          <p className="texto-auxiliar">
            {dia.presentes.map((p) => p.nome).join(', ') || 'Ninguém confirmado ainda.'}
          </p>

          {editavel && (
            <form onSubmit={sortear} className="placar-form" style={{ marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Formato:
                <select value={formato} onChange={(e) => setFormato(e.target.value)}>
                  <option value="4x4">4x4</option>
                  <option value="5x5">5x5</option>
                </select>
              </label>
              <button className="btn btn-primario" type="submit">
                Sortear times
              </button>
            </form>
          )}
        </div>
      )}

      {temTimes && (
        <>
          <h2>Times</h2>
          <div className="grade-times">
            {dia.times.map((time) => (
              <div key={time.id} className="cartao cartao-time">
                <h3>{time.nome}</h3>
                <ul className="lista-jogadores">
                  {time.titulares.map((j) => (
                    <li key={j.id}>
                      <span>{j.nome}</span>
                      {editavel && (
                        <SeletorSuplente
                          jogador={j}
                          times={dia.times}
                          onDefinir={async (timeAlvoId) => {
                            try {
                              await api.definirSuplente(token, id, j.id, timeAlvoId);
                              carregar();
                            } catch (err) {
                              setErro(err.message);
                            }
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {time.suplentes.length > 0 && (
                  <>
                    <div className="etiqueta-suplente">Suplentes emprestados:</div>
                    <ul className="lista-jogadores">
                      {time.suplentes.map((j) => (
                        <li key={j.id}>
                          <span>{j.nome}</span>
                          {editavel && (
                            <button
                              className="btn btn-secundario btn-pequeno"
                              onClick={async () => {
                                try {
                                  await api.definirSuplente(token, id, j.id, null);
                                  carregar();
                                } catch (err) {
                                  setErro(err.message);
                                }
                              }}
                            >
                              Remover
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>

          <h2>Partidas</h2>
          {editavel && (
            <NovaPartida
              times={dia.times}
              onCriar={async (timeAId, timeBId) => {
                try {
                  await api.criarPartida(token, id, timeAId, timeBId);
                  carregar();
                } catch (err) {
                  setErro(err.message);
                }
              }}
            />
          )}

          {dia.partidas.length === 0 && <p className="texto-auxiliar">Nenhuma partida registrada ainda.</p>}

          {dia.partidas.map((partida) => (
            <PartidaCard
              key={partida.id}
              partida={partida}
              dia={dia}
              editavel={editavel}
              onSalvar={async (payload) => {
                try {
                  await api.registrarPlacar(token, id, partida.id, payload);
                  carregar();
                } catch (err) {
                  setErro(err.message);
                }
              }}
              onRemover={async () => {
                if (!window.confirm('Remover esta partida?')) return;
                try {
                  await api.removerPartida(token, id, partida.id);
                  carregar();
                } catch (err) {
                  setErro(err.message);
                }
              }}
            />
          ))}

          <h2>Estatísticas do dia</h2>
          {dia.estatisticas_do_dia.length === 0 ? (
            <p className="texto-auxiliar">Ainda sem gols, assistências ou resultados registrados.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Associado</th>
                  <th>Gols</th>
                  <th>Assistências</th>
                  <th>Vitórias</th>
                  <th>Pontuação</th>
                </tr>
              </thead>
              <tbody>
                {dia.estatisticas_do_dia.map((e) => (
                  <tr key={e.associado_id}>
                    <td>{e.apelido || e.nome}</td>
                    <td>{e.gols}</td>
                    <td>{e.assistencias}</td>
                    <td>{e.vitorias}</td>
                    <td>{e.pontuacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {editavel && (
            <div className="cartao" style={{ marginTop: '1.5rem' }}>
              <h2>Finalizar Dia de Baba</h2>
              <p className="texto-auxiliar">
                Revise os times, partidas e estatísticas acima antes de finalizar. Depois de
                finalizado, nada aqui poderá ser alterado.
              </p>
              <button className="btn btn-perigo" onClick={finalizar}>
                Finalizar Dia de Baba
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SeletorSuplente({ jogador, times, onDefinir }) {
  const outrosTimes = times.filter((t) => t.id !== jogador.time_id);
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (!e.target.value) return;
        onDefinir(Number(e.target.value));
        e.target.value = '';
      }}
    >
      <option value="">Suplente de...</option>
      {outrosTimes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.nome}
        </option>
      ))}
    </select>
  );
}

function NovaPartida({ times, onCriar }) {
  const [timeA, setTimeA] = useState('');
  const [timeB, setTimeB] = useState('');

  return (
    <form
      className="placar-form cartao"
      style={{ marginBottom: '1rem' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!timeA || !timeB || timeA === timeB) return;
        onCriar(Number(timeA), Number(timeB));
        setTimeA('');
        setTimeB('');
      }}
    >
      <select value={timeA} onChange={(e) => setTimeA(e.target.value)}>
        <option value="">Time A</option>
        {times.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
      <span>x</span>
      <select value={timeB} onChange={(e) => setTimeB(e.target.value)}>
        <option value="">Time B</option>
        {times.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
      <button className="btn btn-primario btn-pequeno" type="submit">
        Novo confronto
      </button>
    </form>
  );
}

function PartidaCard({ partida, dia, editavel, onSalvar, onRemover }) {
  const timeA = dia.times.find((t) => t.id === partida.time_a_id);
  const timeB = dia.times.find((t) => t.id === partida.time_b_id);
  const participantes = [...(timeA?.titulares || []), ...(timeA?.suplentes || []), ...(timeB?.titulares || []), ...(timeB?.suplentes || [])];

  const [golsA, setGolsA] = useState(partida.gols_time_a ?? '');
  const [golsB, setGolsB] = useState(partida.gols_time_b ?? '');
  const [eventos, setEventos] = useState(() => montarEventosIniciais(partida, participantes));

  function montarEventosIniciais(partida, participantes) {
    const mapa = {};
    for (const p of participantes) mapa[p.id] = { gols: 0, assistencias: 0 };
    for (const ev of partida.eventos) {
      if (!mapa[ev.escalacao_id]) mapa[ev.escalacao_id] = { gols: 0, assistencias: 0 };
      if (ev.tipo === 'gol') mapa[ev.escalacao_id].gols = ev.quantidade;
      if (ev.tipo === 'assistencia') mapa[ev.escalacao_id].assistencias = ev.quantidade;
    }
    return mapa;
  }

  function atualizar(escalacaoId, campo, valor) {
    setEventos((atual) => ({
      ...atual,
      [escalacaoId]: { ...atual[escalacaoId], [campo]: Math.max(0, Number(valor) || 0) },
    }));
  }

  function salvar(e) {
    e.preventDefault();
    const listaEventos = [];
    for (const [escalacaoId, valores] of Object.entries(eventos)) {
      if (valores.gols > 0) listaEventos.push({ escalacao_id: Number(escalacaoId), tipo: 'gol', quantidade: valores.gols });
      if (valores.assistencias > 0)
        listaEventos.push({ escalacao_id: Number(escalacaoId), tipo: 'assistencia', quantidade: valores.assistencias });
    }
    onSalvar({ gols_time_a: Number(golsA) || 0, gols_time_b: Number(golsB) || 0, eventos: listaEventos });
  }

  return (
    <div className="cartao cartao-partida">
      {editavel ? (
        <form onSubmit={salvar}>
          <div className="placar-form">
            <strong>{timeA?.nome}</strong>
            <input type="number" min="0" value={golsA} onChange={(e) => setGolsA(e.target.value)} />
            <span>x</span>
            <input type="number" min="0" value={golsB} onChange={(e) => setGolsB(e.target.value)} />
            <strong>{timeB?.nome}</strong>
            <button className="btn btn-secundario btn-pequeno" type="button" onClick={onRemover}>
              Remover partida
            </button>
          </div>

          <table className="tabela" style={{ marginTop: '0.7rem' }}>
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Gols</th>
                <th>Assistências</th>
              </tr>
            </thead>
            <tbody>
              {participantes.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={eventos[p.id]?.gols ?? 0}
                      onChange={(e) => atualizar(p.id, 'gols', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={eventos[p.id]?.assistencias ?? 0}
                      onChange={(e) => atualizar(p.id, 'assistencias', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="acoes-formulario" style={{ marginTop: '0.7rem' }}>
            <button className="btn btn-primario btn-pequeno" type="submit">
              Salvar partida
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="placar-form">
            <strong>{timeA?.nome}</strong>
            <span>{partida.gols_time_a ?? '-'}</span>
            <span>x</span>
            <span>{partida.gols_time_b ?? '-'}</span>
            <strong>{timeB?.nome}</strong>
          </div>
          {partida.eventos.length > 0 && (
            <ul className="lista-jogadores" style={{ marginTop: '0.5rem' }}>
              {partida.eventos.map((ev) => (
                <li key={ev.id}>
                  <span>
                    {ev.jogador} — {ev.tipo === 'gol' ? 'gol' : 'assistência'}
                    {ev.quantidade > 1 ? ` (${ev.quantidade}x)` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
