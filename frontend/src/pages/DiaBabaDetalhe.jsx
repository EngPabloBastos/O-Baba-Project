// src/pages/DiaBabaDetalhe.jsx
// Tela central de um Dia de Baba: sorteio, organização dos times (com vagas),
// "Iniciar Baba" e a partida ao vivo (fila "vencedor fica" + gols em tempo real).

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
  const [mostrarEditarTimes, setMostrarEditarTimes] = useState(false);
  const [mensagemDesempate, setMensagemDesempate] = useState('');

  const carregar = useCallback(() => {
    setErro('');
    return api
      .buscarDiaBaba(token, id)
      .then(setDia)
      .catch((err) => setErro(err.message));
  }, [token, id]);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  async function acao(promessa) {
    setErro('');
    try {
      const resultado = await promessa;
      setDia(resultado);
      return resultado;
    } catch (err) {
      setErro(err.message);
      return null;
    }
  }

  async function sortear(e) {
    e.preventDefault();
    acao(api.sortearTimes(token, id, formato));
  }

  async function iniciarBaba() {
    acao(api.iniciarBaba(token, id));
  }

  async function encerrarPartida(partidaId) {
    setErro('');
    setMensagemDesempate('');
    try {
      const resultado = await api.encerrarPartida(token, id, partidaId);
      setDia(resultado);
      if (resultado.mensagem_desempate) setMensagemDesempate(resultado.mensagem_desempate);
    } catch (err) {
      setErro(err.message);
    }
  }

  async function reabrirPartida(partidaId) {
    setMensagemDesempate('');
    acao(api.reabrirPartida(token, id, partidaId));
  }

  async function iniciarPartida(partidaId) {
    acao(api.iniciarPartida(token, id, partidaId));
  }

  async function finalizar() {
    const confirmar = window.confirm(
      'Finalizar este Dia de Baba? Depois de finalizado, nada aqui poderá ser alterado.'
    );
    if (!confirmar) return;
    acao(api.finalizarDiaBaba(token, id));
  }

  if (carregando) return <p className="pagina">Carregando...</p>;
  if (!dia) return <p className="pagina">{erro || 'Dia de Baba não encontrado.'}</p>;

  const editavel = isAdmin && dia.status === 'aberto';
  const temTimes = dia.times.length > 0;
  const partidaReabrivel = dia.partidas_finalizadas.findLast?.((p) => p.pode_reabrir) || null;

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

      {temTimes && !dia.baba_iniciado && (
        <>
          <h2>Times sorteados</h2>
          <PainelGerenciarTimes dia={dia} editavel={editavel} token={token} diaId={id} onMudou={setDia} />
          {editavel && (
            <div className="cartao" style={{ marginTop: '1rem' }}>
              <p className="texto-auxiliar">
                Preencha as vagas antes de começar, se houver. Depois de iniciar, os confrontos vão
                se formando sozinhos: quem vence fica, quem perde (ou empata) volta pra fila.
              </p>
              <button className="btn btn-primario" onClick={iniciarBaba}>
                Iniciar Baba
              </button>
            </div>
          )}
        </>
      )}

      {temTimes && dia.baba_iniciado && (
        <>
          {mensagemDesempate && (
            <div className="cartao" style={{ borderColor: 'var(--cor-primaria)', marginBottom: '1rem' }}>
              <strong>{mensagemDesempate}</strong>
            </div>
          )}

          {editavel && partidaReabrivel && (
            <div className="cartao" style={{ marginBottom: '1rem' }}>
              <p className="texto-auxiliar" style={{ margin: 0 }}>
                A partida "{partidaReabrivel.time_a_nome} x {partidaReabrivel.time_b_nome}" acabou de
                ser encerrada ({partidaReabrivel.gols_time_a} x {partidaReabrivel.gols_time_b}).
              </p>
              <button
                className="btn btn-secundario btn-pequeno"
                style={{ marginTop: '0.5rem' }}
                onClick={() => reabrirPartida(partidaReabrivel.id)}
              >
                Desfazer encerramento
              </button>
            </div>
          )}

          {dia.partida_atual && !dia.partida_atual.iniciada && (
            <ConfrontoPendente
              dia={dia}
              partida={dia.partida_atual}
              editavel={editavel}
              onIniciar={() => iniciarPartida(dia.partida_atual.id)}
            />
          )}

          {dia.partida_atual && dia.partida_atual.iniciada && (
            <PartidaAoVivo
              dia={dia}
              partida={dia.partida_atual}
              editavel={editavel}
              token={token}
              diaId={id}
              onMudou={setDia}
              onEncerrar={() => encerrarPartida(dia.partida_atual.id)}
            />
          )}

          {dia.fila.length > 0 && (
            <div className="cartao" style={{ marginTop: '1rem' }}>
              <strong>Fila de espera:</strong>{' '}
              <span className="texto-auxiliar">{dia.fila.map((f) => f.nome).join(' → ')}</span>
            </div>
          )}

          {editavel && (
            <button
              className="btn btn-secundario btn-pequeno"
              style={{ margin: '1rem 0' }}
              onClick={() => setMostrarEditarTimes((v) => !v)}
            >
              {mostrarEditarTimes ? 'Fechar gerenciamento de times' : 'Gerenciar times'}
            </button>
          )}
          {mostrarEditarTimes && (
            <PainelGerenciarTimes dia={dia} editavel={editavel} token={token} diaId={id} onMudou={setDia} />
          )}

          {dia.partidas_finalizadas.length > 0 && (
            <>
              <h2>Partidas encerradas</h2>
              {dia.partidas_finalizadas.map((p) => (
                <div key={p.id} className="cartao cartao-partida">
                  <div className="placar-form">
                    <strong>{p.time_a_nome}</strong>
                    <span>{p.gols_time_a}</span>
                    <span>x</span>
                    <span>{p.gols_time_b}</span>
                    <strong>{p.time_b_nome}</strong>
                  </div>
                  {p.mensagem_desempate && <p className="texto-auxiliar">{p.mensagem_desempate}</p>}
                  {p.eventos.length > 0 && (
                    <ul className="lista-jogadores">
                      {p.eventos.map((ev) => (
                        <li key={ev.id}>
                          <span>{ev.jogador} — {ev.tipo === 'gol' ? 'gol' : 'assistência'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}

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
                {dia.partida_atual?.iniciada
                  ? 'Encerre a partida ao vivo para poder finalizar o Dia de Baba.'
                  : 'Revise as partidas e estatísticas acima antes de finalizar. Depois de finalizado, nada aqui poderá ser alterado. Se houver um próximo confronto ainda não iniciado, ele será descartado.'}
              </p>
              <button className="btn btn-perigo" onClick={finalizar} disabled={!!dia.partida_atual?.iniciada}>
                Finalizar Dia de Baba
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Painel "Gerenciar times": vagas, remover/devolver jogador, adicionar
// associado ou visitante no meio do baba, criar e apagar times ----------
function PainelGerenciarTimes({ dia, editavel, token, diaId, onMudou }) {
  const [erroLocal, setErroLocal] = useState('');
  const [associados, setAssociados] = useState([]);
  const [associadoEscolhido, setAssociadoEscolhido] = useState('');
  const [timeParaAssociado, setTimeParaAssociado] = useState('');
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [timeParaConvidado, setTimeParaConvidado] = useState('');

  useEffect(() => {
    api.listarAssociados(token, '1').then(setAssociados).catch(() => {});
  }, [token]);

  const idsJaPresentes = new Set(dia.presentes.filter((p) => p.tipo === 'associado').map((p) => p.associado_id));
  const associadosDisponiveis = associados.filter((a) => !idsJaPresentes.has(a.id));

  async function preencherVaga(time, escalacaoId) {
    setErroLocal('');
    try {
      onMudou(await api.definirSuplente(token, diaId, escalacaoId, time.id));
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function removerSuplencia(escalacaoId) {
    setErroLocal('');
    try {
      onMudou(await api.definirSuplente(token, diaId, escalacaoId, null));
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function removerJogador(escalacaoId) {
    setErroLocal('');
    try {
      onMudou(await api.removerJogador(token, diaId, escalacaoId));
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function devolverJogador(escalacaoId, timeId) {
    setErroLocal('');
    try {
      onMudou(await api.moverJogador(token, diaId, escalacaoId, timeId));
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function criarTime() {
    setErroLocal('');
    try {
      onMudou(await api.criarTime(token, diaId));
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function apagarTime(timeId) {
    if (!window.confirm('Apagar esse time? Os jogadores dele vão para "Jogadores sem time".')) return;
    setErroLocal('');
    try {
      onMudou(await api.apagarTime(token, diaId, timeId));
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function adicionarAssociado(e) {
    e.preventDefault();
    if (!associadoEscolhido) return;
    setErroLocal('');
    try {
      const resultado = await api.adicionarAssociado(
        token,
        diaId,
        Number(associadoEscolhido),
        timeParaAssociado ? Number(timeParaAssociado) : null
      );
      onMudou(resultado);
      setAssociadoEscolhido('');
      setTimeParaAssociado('');
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function adicionarConvidado(e) {
    e.preventDefault();
    if (!nomeConvidado.trim()) return;
    setErroLocal('');
    try {
      const resultado = await api.adicionarConvidado(
        token,
        diaId,
        nomeConvidado.trim(),
        timeParaConvidado ? Number(timeParaConvidado) : null
      );
      onMudou(resultado);
      setNomeConvidado('');
      setTimeParaConvidado('');
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  // jogadores de outros times, disponíveis para preencher uma vaga por suplência
  function candidatosParaVaga(time) {
    return dia.times.filter((t) => t.id !== time.id).flatMap((t) => t.titulares);
  }

  return (
    <div>
      <Alerta tipo="erro">{erroLocal}</Alerta>

      <div className="grade-times">
        {dia.times.map((time) => (
          <div key={time.id} className="cartao cartao-time">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>{time.nome}</h3>
              {editavel && (
                <button className="btn btn-secundario btn-pequeno" onClick={() => apagarTime(time.id)}>
                  Apagar time
                </button>
              )}
            </div>
            <ul className="lista-jogadores">
              {time.titulares.map((j) => (
                <li key={j.id}>
                  <span>{j.nome}</span>
                  {editavel && (
                    <button className="btn btn-secundario btn-pequeno" onClick={() => removerJogador(j.id)}>
                      Remover
                    </button>
                  )}
                </li>
              ))}

              {Array.from({ length: time.vagas }).map((_, indice) => (
                <li key={`vaga-${time.id}-${indice}`}>
                  <span className="etiqueta-suplente">Vago</span>
                  {editavel && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        preencherVaga(time, Number(e.target.value));
                        e.target.value = '';
                      }}
                    >
                      <option value="">Escolher jogador...</option>
                      {candidatosParaVaga(time).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
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
                        <button className="btn btn-secundario btn-pequeno" onClick={() => removerSuplencia(j.id)}>
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

      {editavel && (
        <button className="btn btn-secundario btn-pequeno" style={{ marginTop: '0.5rem' }} onClick={criarTime}>
          + Criar novo time
        </button>
      )}

      {editavel && (
        <div className="grade-times" style={{ marginTop: '1rem' }}>
          <form onSubmit={adicionarAssociado} className="cartao formulario">
            <strong>+ Adicionar associado</strong>
            <select value={associadoEscolhido} onChange={(e) => setAssociadoEscolhido(e.target.value)}>
              <option value="">Escolher associado...</option>
              {associadosDisponiveis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.apelido || a.nome}
                </option>
              ))}
            </select>
            <select value={timeParaAssociado} onChange={(e) => setTimeParaAssociado(e.target.value)}>
              <option value="">Sem time (decide depois)</option>
              {dia.times.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button className="btn btn-primario btn-pequeno" type="submit">
              Adicionar
            </button>
          </form>

          <form onSubmit={adicionarConvidado} className="cartao formulario">
            <strong>+ Adicionar visitante</strong>
            <input
              type="text"
              placeholder="Nome do visitante"
              value={nomeConvidado}
              onChange={(e) => setNomeConvidado(e.target.value)}
            />
            <select value={timeParaConvidado} onChange={(e) => setTimeParaConvidado(e.target.value)}>
              <option value="">Sem time (decide depois)</option>
              {dia.times.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button className="btn btn-primario btn-pequeno" type="submit">
              Adicionar
            </button>
          </form>
        </div>
      )}

      <div className="cartao" style={{ marginTop: '1rem' }}>
        <h3>Jogadores sem time</h3>
        {dia.presentes_sem_time.length === 0 ? (
          <p className="texto-auxiliar">Ninguém removido ou sem time no momento.</p>
        ) : (
          <ul className="lista-jogadores">
            {dia.presentes_sem_time.map((j) => (
              <li key={j.id}>
                <span>{j.nome}</span>
                {editavel && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      devolverJogador(j.id, Number(e.target.value));
                      e.target.value = '';
                    }}
                  >
                    <option value="">Colocar em...</option>
                    {dia.times.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------- Confronto pendente: gate antes de cada partida ----------
function ConfrontoPendente({ dia, partida, editavel, onIniciar }) {
  const timeA = dia.times.find((t) => t.id === partida.time_a_id);
  const timeB = dia.times.find((t) => t.id === partida.time_b_id);
  return (
    <div className="cartao" style={{ textAlign: 'center' }}>
      <h2>Próximo confronto</h2>
      <div className="placar-destaque">
        <strong>{timeA?.nome}</strong>
        <span>x</span>
        <strong>{timeB?.nome}</strong>
      </div>
      {editavel && (
        <button className="btn btn-primario btn-gol" onClick={onIniciar}>
          Iniciar partida
        </button>
      )}
    </div>
  );
}

// ---------- Partida ao vivo: placar em destaque, elenco dos dois times, botão de gol ----------
function PartidaAoVivo({ dia, partida, editavel, token, diaId, onMudou, onEncerrar }) {
  const [golAberto, setGolAberto] = useState(false);
  const [timeEscolhido, setTimeEscolhido] = useState('a'); // 'a' | 'b'
  const [marcador, setMarcador] = useState(null); // participante escolhido
  const [assistencia, setAssistencia] = useState(undefined); // participante | null ("não houve") | undefined (ainda não escolheu)
  const [erroLocal, setErroLocal] = useState('');

  const timeA = dia.times.find((t) => t.id === partida.time_a_id);
  const timeB = dia.times.find((t) => t.id === partida.time_b_id);
  const jogadoresTimeA = [...(timeA?.titulares || []), ...(timeA?.suplentes || [])];
  const jogadoresTimeB = [...(timeB?.titulares || []), ...(timeB?.suplentes || [])];
  const jogadoresDoTimeEscolhido = timeEscolhido === 'a' ? jogadoresTimeA : jogadoresTimeB;

  function abrirGol() {
    setGolAberto(true);
    setTimeEscolhido('a');
    setMarcador(null);
    setAssistencia(undefined);
    setErroLocal('');
  }

  function cancelarGol() {
    setGolAberto(false);
    setMarcador(null);
    setAssistencia(undefined);
  }

  function escolherTime(lado) {
    setTimeEscolhido(lado);
    setMarcador(null);
    setAssistencia(undefined);
  }

  async function confirmarGol() {
    if (!marcador) return;
    setErroLocal('');
    try {
      const assistenciaId = assistencia ? assistencia.id : null;
      const resultado = await api.registrarGol(token, diaId, partida.id, marcador.id, assistenciaId);
      onMudou(resultado);
      cancelarGol();
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  async function removerEvento(eventoId) {
    setErroLocal('');
    try {
      const resultado = await api.removerEvento(token, diaId, partida.id, eventoId);
      onMudou(resultado);
    } catch (err) {
      setErroLocal(err.message);
    }
  }

  return (
    <div className="cartao">
      <Alerta tipo="erro">{erroLocal}</Alerta>

      <div className="placar-destaque">
        <strong>{timeA?.nome}</strong>
        <span className="placar-numero">{partida.gols_time_a}</span>
        <span>x</span>
        <span className="placar-numero">{partida.gols_time_b}</span>
        <strong>{timeB?.nome}</strong>
      </div>

      <div className="grade-times">
        <div className="cartao cartao-time">
          <h3>{timeA?.nome}</h3>
          <ul className="lista-jogadores-simples">
            {jogadoresTimeA.map((j) => (
              <li key={j.id}>{j.nome}</li>
            ))}
          </ul>
        </div>
        <div className="cartao cartao-time">
          <h3>{timeB?.nome}</h3>
          <ul className="lista-jogadores-simples">
            {jogadoresTimeB.map((j) => (
              <li key={j.id}>{j.nome}</li>
            ))}
          </ul>
        </div>
      </div>

      {!golAberto && editavel && (
        <button className="btn btn-primario btn-gol" onClick={abrirGol}>
          GOL
        </button>
      )}

      {golAberto && (
        <div className="cartao painel-gol">
          <div className="pilulas">
            <button
              className={`pilula ${timeEscolhido === 'a' ? 'pilula-selecionada' : ''}`}
              onClick={() => escolherTime('a')}
            >
              {timeA?.nome}
            </button>
            <button
              className={`pilula ${timeEscolhido === 'b' ? 'pilula-selecionada' : ''}`}
              onClick={() => escolherTime('b')}
            >
              {timeB?.nome}
            </button>
          </div>

          <strong>Quem fez o gol?</strong>
          <div className="pilulas">
            {jogadoresDoTimeEscolhido.map((j) => (
              <button
                key={j.id}
                className={`pilula ${marcador?.id === j.id ? 'pilula-selecionada' : ''}`}
                onClick={() => {
                  setMarcador(j);
                  setAssistencia(undefined);
                }}
              >
                {j.nome}
              </button>
            ))}
          </div>

          {marcador && (
            <>
              <strong>Quem deu assistência?</strong>
              <div className="pilulas">
                {jogadoresDoTimeEscolhido
                  .filter((j) => j.id !== marcador.id)
                  .map((j) => (
                    <button
                      key={j.id}
                      className={`pilula ${assistencia?.id === j.id ? 'pilula-selecionada' : ''}`}
                      onClick={() => setAssistencia(j)}
                    >
                      {j.nome}
                    </button>
                  ))}
                <button
                  className={`pilula ${assistencia === null ? 'pilula-selecionada' : ''}`}
                  onClick={() => setAssistencia(null)}
                >
                  Não houve assistência
                </button>
              </div>
            </>
          )}

          <div className="acoes-formulario" style={{ marginTop: '1rem' }}>
            <button
              className="btn btn-primario"
              disabled={!marcador || assistencia === undefined}
              onClick={confirmarGol}
            >
              Confirmar gol
            </button>
            <button className="btn btn-secundario" onClick={cancelarGol}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {partida.eventos.length > 0 && (
        <>
          <strong>Registrado nessa partida:</strong>
          <ul className="lista-jogadores">
            {partida.eventos.map((ev) => (
              <li key={ev.id}>
                <span>{ev.jogador} — {ev.tipo === 'gol' ? 'gol' : 'assistência'}</span>
                {editavel && (
                  <button className="btn btn-secundario btn-pequeno" onClick={() => removerEvento(ev.id)}>
                    Desfazer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {editavel && (
        <button className="btn btn-perigo" style={{ marginTop: '1rem' }} onClick={onEncerrar}>
          Encerrar partida
        </button>
      )}
    </div>
  );
}
