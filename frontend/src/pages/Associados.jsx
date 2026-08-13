// src/pages/Associados.jsx
// Lista todos os associados, com filtro de ativos/inativos e busca por nome.
// Cada linha tem ações rápidas: ver/editar, desativar/reativar, excluir.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

const POSICAO_LABEL = { linha: 'Linha', goleiro: 'Goleiro', ambos: 'Ambos' };

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

  async function alternarAtivo(associado) {
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

  async function excluir(associado) {
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
    <div className="pagina">
      <div className="cabecalho-pagina">
        <h1>Associados</h1>
        <Link to="/associados/novo" className="btn btn-primario">
          + Novo associado
        </Link>
      </div>

      <div className="filtros">
        <input
          className="campo-busca"
          type="text"
          placeholder="Buscar por nome ou apelido..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>
      </div>

      <Alerta tipo="erro">{erro}</Alerta>

      {carregando ? (
        <p>Carregando...</p>
      ) : associadosFiltrados.length === 0 ? (
        <p className="texto-auxiliar">Nenhum associado encontrado.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Apelido</th>
              <th>Telefone</th>
              <th>Posição</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {associadosFiltrados.map((a) => (
              <tr key={a.id}>
                <td>{a.nome}</td>
                <td>{a.apelido || '—'}</td>
                <td>{a.telefone}</td>
                <td>{POSICAO_LABEL[a.posicao] || a.posicao}</td>
                <td>
                  <span className={`etiqueta ${a.ativo ? 'etiqueta-ativo' : 'etiqueta-inativo'}`}>
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="acoes">
                  <Link to={`/associados/${a.id}`} className="btn btn-secundario btn-pequeno">
                    Editar
                  </Link>
                  <button
                    className="btn btn-secundario btn-pequeno"
                    onClick={() => alternarAtivo(a)}
                  >
                    {a.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    className="btn btn-perigo btn-pequeno"
                    onClick={() => excluir(a)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
