// src/pages/Associados.jsx
// Lista todos os associados, com filtro de ativos/inativos e busca por nome.
// Cada cartão tem ações rápidas: ver/editar, marcar pagamento, desativar/reativar, excluir.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Cartao, Etiqueta, Secao, Titulo } from '../components/ui.jsx';

export default function Associados() {
  const { token } = useAuth();
  const [associados, setAssociados] = useState([]);
  const [filtro, setFiltro] = useState('todos'); // 'todos' | '1' | '0'
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const ativo = filtro === 'todos' ? undefined : filtro;
      const lista = await api.listarAssociados(token, ativo);
      setAssociados(lista);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function alternarPagamento(e, associado) {
    e.preventDefault();
    e.stopPropagation();
    const novoStatus = associado.status_pagamento === 'pago' ? 'nao_pago' : 'pago';
    try {
      await api.alterarPagamento(token, associado.id, novoStatus);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function alternarAtivo(e, associado) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (associado.ativo) {
        await api.desativarAssociado(token, associado.id);
      } else {
        await api.reativarAssociado(token, associado.id);
      }
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function excluir(e, associado) {
    e.preventDefault();
    e.stopPropagation();
    const confirmar = window.confirm(
      `Excluir "${associado.nome}" definitivamente? Isso apaga o histórico dele. Prefira desativar, se não tiver certeza.`
    );
    if (!confirmar) return;
    try {
      await api.excluirAssociado(token, associado.id);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  const associadosFiltrados = associados.filter((a) =>
    `${a.nome} ${a.apelido ?? ''}`.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="flex-row items-center justify-between pt-lg">
        <Titulo>Associados</Titulo>
        <Link to="/associados/novo">
          <Botao tamanho="pequeno">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Novo
          </Botao>
        </Link>
      </Secao>

      <Secao className="flex-row gap-sm">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
            search
          </span>
          <input
            className="w-full h-12 pl-12 pr-sm rounded-xl bg-surface-container text-on-surface font-body-md placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            type="text"
            placeholder="Buscar por nome ou apelido..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          className="h-12 px-sm rounded-xl bg-surface-container text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>
      </Secao>

      <Secao>
        <Alerta tipo="erro">{erro}</Alerta>
      </Secao>

      <Secao className="gap-sm">
        {carregando ? (
          <p className="text-body-md text-on-surface-variant">Carregando...</p>
        ) : associadosFiltrados.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">Nenhum associado encontrado.</p>
        ) : (
          associadosFiltrados.map((a) => (
            <Link key={a.id} to={`/associados/${a.id}`}>
              <Cartao
                className={`flex items-center justify-between gap-md transition-transform active:scale-[0.98] ${
                  !a.ativo ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-md min-w-0">
                  <Avatar nome={a.apelido || a.nome} tamanho={48} tom="verde" />
                  <div className="min-w-0 flex flex-col gap-[2px]">
                    <span className="font-label-bold text-on-surface truncate">{a.nome}</span>
                    <span className="text-label-sm text-on-surface-variant truncate">
                      {a.apelido ? `${a.apelido} · ` : ''}
                      {a.telefone}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-xs shrink-0">
                  <button onClick={(e) => alternarPagamento(e, a)} title="Clique para alternar">
                    <Etiqueta tom={a.status_pagamento === 'pago' ? 'verde' : 'vermelho'}>
                      {a.status_pagamento === 'pago' ? 'Pago' : 'Não pago'}
                    </Etiqueta>
                  </button>
                  <button
                    onClick={(e) => alternarAtivo(e, a)}
                    title={a.ativo ? 'Desativar' : 'Reativar'}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface-variant/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {a.ativo ? 'toggle_on' : 'toggle_off'}
                    </span>
                  </button>
                  <button
                    onClick={(e) => excluir(e, a)}
                    title="Excluir"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-error hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </Cartao>
            </Link>
          ))
        )}
      </Secao>
    </div>
  );
}

