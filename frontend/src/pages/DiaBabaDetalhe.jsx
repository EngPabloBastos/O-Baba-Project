// src/pages/DiaBabaDetalhe.jsx
// Tela central de um Dia de Baba: sorteio, organização dos times (com vagas),
// "Iniciar Baba" e a partida ao vivo (fila "vencedor fica" + gols em tempo real).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Cartao, Etiqueta, Secao, Titulo } from '../components/ui.jsx';

// pílula de seleção reutilizada em vários pontos (escolher time, jogador, etc)
function Pilula({ selecionada, children, ...props }) {
  return (
    <button
      type="button"
      className={`px-md py-sm rounded-full font-label-bold text-label-sm border-2 transition-colors ${
        selecionada
          ? 'bg-primary text-on-primary border-primary'
          : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary/50'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

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

  if (carregando) return <p className="px-container-padding pt-md text-body-md text-on-surface-variant">Carregando...</p>;
  if (!dia) return <p className="px-container-padding pt-md text-body-md text-on-surface-variant">{erro || 'Dia de Baba não encontrado.'}</p>;

  const editavel = isAdmin && dia.status === 'aberto';
  const temTimes = dia.times.length > 0;
  const partidaReabrivel = dia.partidas_finalizadas.findLast?.((p) => p.pode_reabrir) || null;

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="flex-row items-center justify-between pt-lg">
        <div className="flex items-center gap-sm min-w-0">
          <button
            onClick={() => navigate('/dias-baba')}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface-variant/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0">
            <Titulo className="truncate">{new Date(`${dia.data}T00:00:00`).toLocaleDateString('pt-BR')}</Titulo>
            <div className="flex items-center gap-xs mt-[2px]">
              <Etiqueta tom={dia.status === 'aberto' ? 'amarelo' : 'neutro'}>
                {dia.status === 'aberto' ? 'Em andamento' : 'Finalizado'}
              </Etiqueta>
              {dia.formato && <span className="text-label-sm text-on-surface-variant">formato {dia.formato}</span>}
            </div>
          </div>
        </div>
      </Secao>

      <Secao>
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      {!temTimes && (
        <Secao>
          <Cartao>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">
              Presentes ({dia.presentes.length})
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {dia.presentes.map((p) => p.nome).join(', ') || 'Ninguém confirmado ainda.'}
            </p>

            {editavel && (
              <form onSubmit={sortear} className="flex items-end gap-sm mt-md flex-wrap">
                <label className="flex flex-col gap-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant ml-1">Formato</span>
                  <select
                    value={formato}
                    onChange={(e) => setFormato(e.target.value)}
                    className="h-12 px-md rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="4x4">4x4</option>
                    <option value="5x5">5x5</option>
                  </select>
                </label>
                <Botao variante="primario" type="submit">
                  Sortear times
                </Botao>
              </form>
            )}
          </Cartao>
        </Secao>
      )}

      {temTimes && !dia.baba_iniciado && (
        <>
          <Secao className="pb-0">
            <h2 className="font-headline-md text-headline-md text-on-surface">Times sorteados</h2>
          </Secao>
          <PainelGerenciarTimes dia={dia} editavel={editavel} token={token} diaId={id} onMudou={setDia} />
          {editavel && (
            <Secao>
              <Cartao>
                <p className="text-body-md text-on-surface-variant mb-md">
                  Preencha as vagas antes de começar, se houver. Depois de iniciar, os confrontos vão se
                  formando sozinhos: quem vence fica, quem perde (ou empata) volta pra fila.
                </p>
                <Botao variante="primario" tamanho="grande" className="w-full" onClick={iniciarBaba}>
                  <span className="material-symbols-outlined">play_arrow</span>
                  Iniciar Baba
                </Botao>
              </Cartao>
            </Secao>
          )}
        </>
      )}

      {temTimes && dia.baba_iniciado && (
        <>
          {mensagemDesempate && (
            <Secao>
              <Cartao className="bg-tertiary-fixed/40 border-2 border-tertiary-fixed-dim flex items-center gap-sm">
                <span className="material-symbols-outlined text-on-tertiary-fixed-variant">casino</span>
                <strong className="text-body-md text-on-tertiary-fixed-variant">{mensagemDesempate}</strong>
              </Cartao>
            </Secao>
          )}

          {editavel && partidaReabrivel && (
            <Secao>
              <Cartao className="border-2 border-outline-variant">
                <p className="text-body-md text-on-surface-variant">
                  A partida "{partidaReabrivel.time_a_nome} x {partidaReabrivel.time_b_nome}" acabou de ser
                  encerrada ({partidaReabrivel.gols_time_a} x {partidaReabrivel.gols_time_b}).
                </p>
                <Botao
                  variante="secundario"
                  tamanho="pequeno"
                  className="mt-sm"
                  onClick={() => reabrirPartida(partidaReabrivel.id)}
                >
                  <span className="material-symbols-outlined text-[18px]">undo</span>
                  Desfazer encerramento
                </Botao>
              </Cartao>
            </Secao>
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
            <Secao>
              <Cartao className="flex items-center gap-sm overflow-x-auto no-scrollbar">
                <span className="material-symbols-outlined text-on-surface-variant shrink-0">queue</span>
                <div className="flex items-center gap-xs text-label-sm font-label-bold text-on-surface-variant whitespace-nowrap">
                  {dia.fila.map((f, i) => (
                    <span key={f.id} className="flex items-center gap-xs">
                      {i > 0 && <span className="material-symbols-outlined text-[14px]">arrow_forward</span>}
                      {f.nome}
                    </span>
                  ))}
                </div>
              </Cartao>
            </Secao>
          )}

          {editavel && (
            <Secao className="pb-0">
              <Botao variante="secundario" tamanho="pequeno" onClick={() => setMostrarEditarTimes((v) => !v)}>
                <span className="material-symbols-outlined text-[18px]">groups</span>
                {mostrarEditarTimes ? 'Fechar gerenciamento de times' : 'Gerenciar times'}
              </Botao>
            </Secao>
          )}
          {mostrarEditarTimes && (
            <PainelGerenciarTimes dia={dia} editavel={editavel} token={token} diaId={id} onMudou={setDia} />
          )}

          {dia.partidas_finalizadas.length > 0 && (
            <>
              <Secao className="pb-0">
                <h2 className="font-headline-md text-headline-md text-on-surface">Partidas encerradas</h2>
              </Secao>
              <Secao className="gap-sm">
                {dia.partidas_finalizadas.map((p) => (
                  <Cartao key={p.id}>
                    <div className="flex items-center justify-center gap-md text-body-md font-label-bold text-on-surface">
                      <span className="truncate">{p.time_a_nome}</span>
                      <span className="font-headline-md text-headline-md text-primary">
                        {p.gols_time_a} x {p.gols_time_b}
                      </span>
                      <span className="truncate">{p.time_b_nome}</span>
                    </div>
                    {p.mensagem_desempate && (
                      <p className="text-label-sm text-on-surface-variant text-center mt-xs">{p.mensagem_desempate}</p>
                    )}
                    {p.eventos.length > 0 && (
                      <ul className="flex flex-col gap-[2px] mt-sm border-t border-outline-variant/30 pt-sm">
                        {p.eventos.map((ev) => (
                          <li key={ev.id} className="text-label-sm text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              {ev.tipo === 'gol' ? 'sports_soccer' : 'ads_click'}
                            </span>
                            {ev.jogador} — {ev.tipo === 'gol' ? 'gol' : 'assistência'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Cartao>
                ))}
              </Secao>
            </>
          )}

          <Secao className="pb-0">
            <h2 className="font-headline-md text-headline-md text-on-surface">Estatísticas do dia</h2>
          </Secao>
          <Secao className="gap-sm">
            {dia.estatisticas_do_dia.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">Ainda sem gols, assistências ou resultados registrados.</p>
            ) : (
              dia.estatisticas_do_dia.map((e) => (
                <Cartao key={e.associado_id} className="flex items-center gap-md">
                  <Avatar nome={e.apelido || e.nome} tamanho={40} tom="verde" />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-bold text-on-surface truncate">{e.apelido || e.nome}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {e.gols}G · {e.assistencias}A · {e.vitorias}V
                    </p>
                  </div>
                  <span className="font-headline-md text-headline-md text-primary shrink-0">{e.pontuacao} pts</span>
                </Cartao>
              ))
            )}
          </Secao>

          {editavel && (
            <Secao>
              <Cartao>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Finalizar Dia de Baba</h2>
                <p className="text-body-md text-on-surface-variant mb-md">
                  {dia.partida_atual?.iniciada
                    ? 'Encerre a partida ao vivo para poder finalizar o Dia de Baba.'
                    : 'Revise as partidas e estatísticas acima antes de finalizar. Depois de finalizado, nada aqui poderá ser alterado. Se houver um próximo confronto ainda não iniciado, ele será descartado.'}
                </p>
                <Botao
                  variante="perigoCheio"
                  className="w-full"
                  onClick={finalizar}
                  disabled={!!dia.partida_atual?.iniciada}
                >
                  Finalizar Dia de Baba
                </Botao>
              </Cartao>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Confronto pendente: gate antes de cada partida ----------
function ConfrontoPendente({ dia, partida, editavel, onIniciar }) {
  const timeA = dia.times.find((t) => t.id === partida.time_a_id);
  const timeB = dia.times.find((t) => t.id === partida.time_b_id);
  return (
    <Secao>
      <Cartao className="text-center py-lg">
        <p className="font-label-bold text-label-sm text-on-surface-variant uppercase tracking-wider mb-sm">
          Próximo confronto
        </p>
        <div className="flex items-center justify-center gap-md mb-lg">
          <span className="font-headline-md text-headline-md text-on-surface">{timeA?.nome}</span>
          <span className="font-label-bold text-on-surface-variant">x</span>
          <span className="font-headline-md text-headline-md text-on-surface">{timeB?.nome}</span>
        </div>
        {editavel && (
          <Botao variante="primario" tamanho="grande" className="w-full" onClick={onIniciar}>
            <span className="material-symbols-outlined">play_arrow</span>
            Iniciar partida
          </Botao>
        )}
      </Cartao>
    </Secao>
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
    <Secao>
      <Cartao className="p-0 overflow-hidden">
        {/* placar em destaque */}
        <div className="bg-primary text-on-primary px-md py-lg flex items-center justify-center gap-md">
          <span className="font-label-bold text-label-sm text-center flex-1 truncate">{timeA?.nome}</span>
          <span className="font-headline-lg text-headline-lg tabular-nums shrink-0">
            {partida.gols_time_a} <span className="opacity-60 text-headline-md">x</span> {partida.gols_time_b}
          </span>
          <span className="font-label-bold text-label-sm text-center flex-1 truncate">{timeB?.nome}</span>
        </div>

        <div className="p-md flex flex-col gap-md">
          <Alerta tipo="erro">{erroLocal}</Alerta>

          {/* elenco dos dois times */}
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <p className="font-label-bold text-label-sm text-on-surface-variant mb-xs truncate">{timeA?.nome}</p>
              <ul className="flex flex-col gap-[2px]">
                {jogadoresTimeA.map((j) => (
                  <li key={j.id} className="text-body-md text-on-surface truncate">
                    {j.nome}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-label-bold text-label-sm text-on-surface-variant mb-xs truncate">{timeB?.nome}</p>
              <ul className="flex flex-col gap-[2px]">
                {jogadoresTimeB.map((j) => (
                  <li key={j.id} className="text-body-md text-on-surface truncate">
                    {j.nome}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {!golAberto && editavel && (
            <Botao variante="primario" tamanho="grande" className="w-full" onClick={abrirGol}>
              <span className="material-symbols-outlined icon-filled">sports_soccer</span>
              GOL
            </Botao>
          )}

          {golAberto && (
            <Cartao className="bg-surface-container border border-outline-variant/50 flex flex-col gap-sm">
              <div className="flex gap-sm">
                <Pilula selecionada={timeEscolhido === 'a'} onClick={() => escolherTime('a')} className="flex-1">
                  {timeA?.nome}
                </Pilula>
                <Pilula selecionada={timeEscolhido === 'b'} onClick={() => escolherTime('b')} className="flex-1">
                  {timeB?.nome}
                </Pilula>
              </div>

              <p className="font-label-bold text-label-sm text-on-surface-variant">Quem fez o gol?</p>
              <div className="flex flex-wrap gap-xs">
                {jogadoresDoTimeEscolhido.map((j) => (
                  <Pilula
                    key={j.id}
                    selecionada={marcador?.id === j.id}
                    onClick={() => {
                      setMarcador(j);
                      setAssistencia(undefined);
                    }}
                  >
                    {j.nome}
                  </Pilula>
                ))}
              </div>

              {marcador && (
                <>
                  <p className="font-label-bold text-label-sm text-on-surface-variant">Quem deu assistência?</p>
                  <div className="flex flex-wrap gap-xs">
                    {jogadoresDoTimeEscolhido
                      .filter((j) => j.id !== marcador.id)
                      .map((j) => (
                        <Pilula key={j.id} selecionada={assistencia?.id === j.id} onClick={() => setAssistencia(j)}>
                          {j.nome}
                        </Pilula>
                      ))}
                    <Pilula selecionada={assistencia === null} onClick={() => setAssistencia(null)}>
                      Não houve assistência
                    </Pilula>
                  </div>
                </>
              )}

              <div className="flex gap-sm mt-sm">
                <Botao variante="primario" disabled={!marcador || assistencia === undefined} onClick={confirmarGol} className="flex-1">
                  Confirmar gol
                </Botao>
                <Botao variante="secundario" onClick={cancelarGol}>
                  Cancelar
                </Botao>
              </div>
            </Cartao>
          )}

          {partida.eventos.length > 0 && (
            <div className="border-t border-outline-variant/30 pt-sm">
              <p className="font-label-bold text-label-sm text-on-surface-variant mb-xs">Registrado nessa partida:</p>
              <ul className="flex flex-col gap-xs">
                {partida.eventos.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-sm">
                    <span className="text-body-md text-on-surface flex items-center gap-1 min-w-0 truncate">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
                        {ev.tipo === 'gol' ? 'sports_soccer' : 'ads_click'}
                      </span>
                      <span className="truncate">
                        {ev.jogador} — {ev.tipo === 'gol' ? 'gol' : 'assistência'}
                      </span>
                    </span>
                    {editavel && (
                      <button
                        onClick={() => removerEvento(ev.id)}
                        className="text-error text-label-sm font-label-bold shrink-0 px-2 py-1 rounded-lg hover:bg-error/10"
                      >
                        Desfazer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editavel && (
            <Botao variante="perigoCheio" className="w-full" onClick={onEncerrar}>
              Encerrar partida
            </Botao>
          )}
        </div>
      </Cartao>
    </Secao>
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
    <>
      <Secao>
        <Alerta tipo="erro">{erroLocal}</Alerta>
      </Secao>

      <Secao className="gap-sm">
        {dia.times.map((time) => (
          <Cartao key={time.id}>
            <div className="flex items-center justify-between mb-sm">
              <h3 className="font-headline-md text-headline-md text-on-surface">{time.nome}</h3>
              {editavel && (
                <button
                  onClick={() => apagarTime(time.id)}
                  className="text-error text-label-sm font-label-bold px-2 py-1 rounded-lg hover:bg-error/10"
                >
                  Apagar time
                </button>
              )}
            </div>

            <ul className="flex flex-col gap-xs">
              {time.titulares.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-sm">
                  <span className="flex items-center gap-sm min-w-0">
                    <Avatar nome={j.nome} tamanho={32} tom="neutro" />
                    <span className="text-body-md text-on-surface truncate">{j.nome}</span>
                  </span>
                  {editavel && (
                    <button
                      onClick={() => removerJogador(j.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-error hover:bg-error/10 shrink-0"
                      title="Remover"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  )}
                </li>
              ))}

              {Array.from({ length: time.vagas }).map((_, indice) => (
                <li key={`vaga-${time.id}-${indice}`} className="flex items-center justify-between gap-sm">
                  <span className="flex items-center gap-sm min-w-0">
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-outline">person_add</span>
                    </div>
                    <Etiqueta tom="neutro">Vago</Etiqueta>
                  </span>
                  {editavel && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        preencherVaga(time, Number(e.target.value));
                        e.target.value = '';
                      }}
                      className="h-9 px-2 rounded-lg bg-surface-container text-on-surface text-label-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                <div className="font-label-sm text-label-sm text-on-surface-variant mt-md mb-xs">
                  Suplentes emprestados:
                </div>
                <ul className="flex flex-col gap-xs">
                  {time.suplentes.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-sm">
                      <span className="flex items-center gap-sm min-w-0">
                        <Avatar nome={j.nome} tamanho={32} tom="cinza" />
                        <span className="text-body-md text-on-surface truncate">{j.nome}</span>
                      </span>
                      {editavel && (
                        <button
                          onClick={() => removerSuplencia(j.id)}
                          className="text-label-sm font-label-bold text-on-surface-variant px-2 py-1 rounded-lg hover:bg-on-surface-variant/10 shrink-0"
                        >
                          Remover
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Cartao>
        ))}
      </Secao>

      {editavel && (
        <Secao className="pt-0 pb-0">
          <Botao variante="secundario" tamanho="pequeno" onClick={criarTime}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Criar novo time
          </Botao>
        </Secao>
      )}

      {editavel && (
        <Secao className="gap-sm">
          <Cartao>
            <form onSubmit={adicionarAssociado} className="flex flex-col gap-sm">
              <strong className="font-label-bold text-on-surface">+ Adicionar associado</strong>
              <select
                value={associadoEscolhido}
                onChange={(e) => setAssociadoEscolhido(e.target.value)}
                className="h-11 px-md rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Escolher associado...</option>
                {associadosDisponiveis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.apelido || a.nome}
                  </option>
                ))}
              </select>
              <select
                value={timeParaAssociado}
                onChange={(e) => setTimeParaAssociado(e.target.value)}
                className="h-11 px-md rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sem time (decide depois)</option>
                {dia.times.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <Botao variante="primario" tamanho="pequeno" type="submit">
                Adicionar
              </Botao>
            </form>
          </Cartao>

          <Cartao>
            <form onSubmit={adicionarConvidado} className="flex flex-col gap-sm">
              <strong className="font-label-bold text-on-surface">+ Adicionar visitante</strong>
              <input
                type="text"
                placeholder="Nome do visitante"
                value={nomeConvidado}
                onChange={(e) => setNomeConvidado(e.target.value)}
                className="h-11 px-md rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={timeParaConvidado}
                onChange={(e) => setTimeParaConvidado(e.target.value)}
                className="h-11 px-md rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sem time (decide depois)</option>
                {dia.times.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <Botao variante="primario" tamanho="pequeno" type="submit">
                Adicionar
              </Botao>
            </form>
          </Cartao>
        </Secao>
      )}

      <Secao>
        <Cartao>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Jogadores sem time</h3>
          {dia.presentes_sem_time.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Ninguém removido ou sem time no momento.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {dia.presentes_sem_time.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-sm">
                  <span className="flex items-center gap-sm min-w-0">
                    <Avatar nome={j.nome} tamanho={32} tom="neutro" />
                    <span className="text-body-md text-on-surface truncate">{j.nome}</span>
                  </span>
                  {editavel && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        devolverJogador(j.id, Number(e.target.value));
                        e.target.value = '';
                      }}
                      className="h-9 px-2 rounded-lg bg-surface-container text-on-surface text-label-sm focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
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
        </Cartao>
      </Secao>
    </>
  );
}
