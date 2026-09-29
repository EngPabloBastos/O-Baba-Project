// src/pages/HallDaFama.jsx
// Vencedores de cada premiação, por mês ou por ano. Só lista períodos que já foram
// fechados/lançados. Admin ganha, no fim da página, o painel para fechar um período
// (calcula as 3 automáticas) e lançar quem ganhou os prêmios por voto.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, urlArquivo } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Campo, Cartao, RotuloSecao, Secao, Titulo } from '../components/ui.jsx';
import { Insignia, PREMIOS, MESES_LONGOS } from '../components/Conquistas.jsx';

const DESCRICAO = {
  artilheiro: 'Mais gols no período',
  garcom: 'Mais assistências no período',
  melhor_jogador_por_pontos: 'Maior pontuação no período',
};
const PREMIOS_POR_VOTO = ['melhor_jogador_por_voto', 'xerife', 'melhor_goleiro'];

const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

function Segmentado({ valor, opcoes, onChange }) {
  return (
    <div className="flex bg-surface-variant rounded-xl p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => onChange(o.valor)}
          className={`flex-1 font-label-bold text-label-bold py-sm text-center rounded-lg transition-colors ${
            valor === o.valor ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

const SELECT_CLASSES =
  'h-11 px-sm rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary';

export default function HallDaFama() {
  const { token, isAdmin } = useAuth();

  const [periodos, setPeriodos] = useState({ mensais: [], anuais: [] });
  const [modo, setModo] = useState('mensal');
  const [selecionado, setSelecionado] = useState(null);
  const [premios, setPremios] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0); // aumenta após ações do admin, pra recarregar

  // painel do admin
  const [adminModo, setAdminModo] = useState('mensal');
  const [adminMes, setAdminMes] = useState(MES_ATUAL);
  const [adminAno, setAdminAno] = useState(ANO_ATUAL);
  const [tipoVoto, setTipoVoto] = useState(PREMIOS_POR_VOTO[0]);
  const [jogadorId, setJogadorId] = useState('');
  const [associados, setAssociados] = useState([]);
  const [erroAdmin, setErroAdmin] = useState('');
  const [sucessoAdmin, setSucessoAdmin] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const opcoes =
    modo === 'mensal'
      ? periodos.mensais.map((p) => ({
          chave: `${p.ano}-${p.mes}`,
          rotulo: `${MESES_LONGOS[p.mes - 1]} ${p.ano}`,
          periodo: 'mensal',
          ano: p.ano,
          mes: p.mes,
        }))
      : periodos.anuais.map((a) => ({ chave: String(a), rotulo: String(a), periodo: 'anual', ano: a, mes: 0 }));
  const atual = opcoes.find((o) => o.chave === selecionado) || opcoes[0] || null;

  // períodos que já têm premiação
  useEffect(() => {
    api
      .buscarPeriodosPremiacoes(token)
      .then((p) => {
        setPeriodos(p);
        // se não há nenhum mês mas há ano fechado, abre direto no anual
        setModo((m) => (m === 'mensal' && p.mensais.length === 0 && p.anuais.length > 0 ? 'anual' : m));
      })
      .catch((err) => setErro(err.message));
  }, [token, versao]);

  // vencedores do período escolhido
  const chaveAtual = atual?.chave;
  useEffect(() => {
    if (!atual) {
      setPremios(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    api
      .buscarPremiacoes(token, { periodo: atual.periodo, ano: atual.ano, mes: atual.mes })
      .then((r) => setPremios(r.premios))
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, chaveAtual, atual?.periodo, versao]);

  // lista de jogadores para o formulário de voto
  useEffect(() => {
    if (!isAdmin) return;
    api.listarAssociados(token).then(setAssociados).catch(() => {});
  }, [token, isAdmin]);

  function dadosDoPeriodoAdmin() {
    return adminModo === 'mensal'
      ? { periodo: 'mensal', ano: adminAno, mes: adminMes }
      : { periodo: 'anual', ano: adminAno };
  }

  function irParaPeriodoAdmin() {
    setModo(adminModo);
    setSelecionado(adminModo === 'mensal' ? `${adminAno}-${adminMes}` : String(adminAno));
    setVersao((v) => v + 1);
  }

  async function executarAdmin(acao) {
    setErroAdmin('');
    setSucessoAdmin('');
    setOcupado(true);
    try {
      await acao();
      irParaPeriodoAdmin();
    } catch (err) {
      setErroAdmin(err.message);
    } finally {
      setOcupado(false);
    }
  }

  function fechar() {
    executarAdmin(async () => {
      await api.fecharPeriodoPremiacoes(token, dadosDoPeriodoAdmin());
      setSucessoAdmin('Período fechado: Artilheiro, Garçom e Melhor por Pontos calculados.');
    });
  }

  function lancarVoto() {
    if (!jogadorId) {
      setErroAdmin('Escolha o jogador premiado.');
      return;
    }
    const senha = window.prompt('Para lançar a premiação, digite a senha de confirmação:');
    if (senha === null) return;
    executarAdmin(async () => {
      await api.lancarPremiacaoPorVoto(
        token,
        { tipo: tipoVoto, associado_id: Number(jogadorId), ...dadosDoPeriodoAdmin() },
        senha
      );
      setSucessoAdmin(`${PREMIOS[tipoVoto].rotulo} lançado.`);
      setJogadorId('');
    });
  }

  function removerPeriodo() {
    const senha = window.prompt(
      'Isso remove TODAS as premiações desse período (automáticas e por voto). Digite a senha de confirmação:'
    );
    if (senha === null) return;
    executarAdmin(async () => {
      await api.removerPremiacoesDoPeriodo(token, dadosDoPeriodoAdmin(), senha);
      setSucessoAdmin('Premiações do período removidas.');
    });
  }

  function removerVencedor(premio, vencedor) {
    const senha = window.prompt(
      `Remover ${vencedor.nome} de "${premio.rotulo}"? Digite a senha de confirmação:`
    );
    if (senha === null) return;
    setErro('');
    api
      .removerPremiacao(token, vencedor.id, senha)
      .then(() => setVersao((v) => v + 1))
      .catch((err) => setErro(err.message));
  }

  const anual = modo === 'anual';

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="pt-lg">
        <Titulo>Hall da Fama</Titulo>
        <p className="text-body-md text-on-surface-variant">Quem levou cada prêmio no período.</p>
      </Secao>

      <Secao className="pt-0">
        <Segmentado
          valor={modo}
          onChange={(m) => {
            setModo(m);
            setSelecionado(null);
          }}
          opcoes={[
            { valor: 'mensal', rotulo: 'Mensal' },
            { valor: 'anual', rotulo: 'Anual' },
          ]}
        />
        {opcoes.length > 0 && (
          <select
            className={`${SELECT_CLASSES} w-full`}
            value={atual?.chave ?? ''}
            onChange={(e) => setSelecionado(e.target.value)}
          >
            {opcoes.map((o) => (
              <option key={o.chave} value={o.chave}>
                {o.rotulo}
              </option>
            ))}
          </select>
        )}
      </Secao>

      <Secao className="pt-0">
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      <Secao className="gap-sm">
        {!atual ? (
          <Cartao>
            <p className="text-body-md text-on-surface-variant">
              {anual ? 'Nenhum ano fechado ainda.' : 'Nenhuma premiação fechada ainda.'}
            </p>
          </Cartao>
        ) : carregando && !premios ? (
          <p className="text-body-md text-on-surface-variant">Carregando...</p>
        ) : (
          (premios || []).map((premio) => {
            const vazio = premio.vencedores.length === 0;
            return (
              <Cartao key={premio.tipo} className="flex flex-col gap-md">
                <div className="flex items-center gap-md">
                  <Insignia tipo={premio.tipo} anual={anual} tamanho={anual ? 56 : 60} apagada={vazio} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-md text-[18px] leading-tight text-on-surface">
                      {premio.rotulo}
                      {anual ? ' do Ano' : ''}
                    </span>
                    {DESCRICAO[premio.tipo] && (
                      <span className="text-label-sm text-on-surface-variant">{DESCRICAO[premio.tipo]}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-sm bg-surface-container rounded-xl p-sm">
                  {vazio ? (
                    <p className="text-body-md text-on-surface-variant px-1 py-1">Ainda não definido</p>
                  ) : (
                    premio.vencedores.map((v) => (
                      <div key={v.id} className="flex items-center gap-sm">
                        <Link
                          to={`/jogadores/${v.associado_id}`}
                          className="flex items-center gap-md flex-1 min-w-0 active:opacity-70 transition-opacity"
                        >
                          <Avatar nome={v.apelido || v.nome} foto={urlArquivo(v.foto_url)} tamanho={40} tom="verde" />
                          <div className="flex flex-col min-w-0 flex-1 leading-tight">
                            <span className="font-label-bold text-on-surface truncate">{v.nome}</span>
                            {v.apelido && (
                              <span className="text-label-sm text-on-surface-variant truncate">{v.apelido}</span>
                            )}
                          </div>
                          {premio.origem === 'automatica' ? (
                            <div className="flex flex-col items-end leading-tight shrink-0">
                              <span className="font-headline-md text-[22px] text-primary tabular-nums">
                                {v.valor}
                              </span>
                              <span className="text-label-sm text-on-surface-variant">{premio.unidade}</span>
                            </div>
                          ) : (
                            <span className="shrink-0 bg-surface-container-lowest rounded-full px-sm py-[3px] font-label-bold text-label-sm text-on-surface-variant">
                              Eleito por voto
                            </span>
                          )}
                        </Link>
                        {isAdmin && premio.origem === 'manual' && (
                          <button
                            onClick={() => removerVencedor(premio, v)}
                            title="Remover lançamento"
                            className="w-9 h-9 flex items-center justify-center rounded-full text-error hover:bg-error/10 transition-colors shrink-0"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Cartao>
            );
          })
        )}
      </Secao>

      {isAdmin && (
        <Secao>
          <Cartao className="flex flex-col gap-md">
            <RotuloSecao>Gerenciar premiações</RotuloSecao>

            <div className="flex flex-col gap-sm">
              <Segmentado
                valor={adminModo}
                onChange={setAdminModo}
                opcoes={[
                  { valor: 'mensal', rotulo: 'Mensal' },
                  { valor: 'anual', rotulo: 'Anual' },
                ]}
              />
              <div className="flex gap-sm">
                {adminModo === 'mensal' && (
                  <select
                    className={`${SELECT_CLASSES} flex-1`}
                    value={adminMes}
                    onChange={(e) => setAdminMes(Number(e.target.value))}
                  >
                    {MESES_LONGOS.map((nome, i) => (
                      <option key={nome} value={i + 1}>
                        {nome}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  className={`${SELECT_CLASSES} ${adminModo === 'mensal' ? '' : 'flex-1'}`}
                  value={adminAno}
                  onChange={(e) => setAdminAno(Number(e.target.value))}
                >
                  {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <Botao onClick={fechar} disabled={ocupado}>
                <span className="material-symbols-outlined text-[20px]">lock_clock</span>
                Fechar período
              </Botao>
              <p className="text-label-sm text-on-surface-variant">
                Calcula Artilheiro, Garçom e Melhor por Pontos (empate: quem jogou menos partidas). Pode repetir
                para recalcular; os prêmios por voto não são alterados.
              </p>
            </div>

            <div className="flex flex-col gap-sm border-t border-on-surface/5 pt-md">
              <RotuloSecao>Lançar prêmio por voto</RotuloSecao>
              <Campo label="Prêmio" as="select" value={tipoVoto} onChange={(e) => setTipoVoto(e.target.value)}>
                {PREMIOS_POR_VOTO.map((t) => (
                  <option key={t} value={t}>
                    {PREMIOS[t].rotulo}
                  </option>
                ))}
              </Campo>
              <Campo label="Jogador" as="select" value={jogadorId} onChange={(e) => setJogadorId(e.target.value)}>
                <option value="">Selecione...</option>
                {associados.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                    {a.apelido ? ` (${a.apelido})` : ''}
                  </option>
                ))}
              </Campo>
              <Botao variante="secundario" onClick={lancarVoto} disabled={ocupado}>
                <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                Lançar
              </Botao>
            </div>

            <Alerta tipo="erro">{erroAdmin}</Alerta>
            <Alerta tipo="sucesso">{sucessoAdmin}</Alerta>

            <Botao variante="perigo" tamanho="pequeno" onClick={removerPeriodo} disabled={ocupado}>
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Remover premiações do período
            </Botao>
          </Cartao>
        </Secao>
      )}
    </div>
  );
}
