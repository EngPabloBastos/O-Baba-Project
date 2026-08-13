// src/pages/AssociadoForm.jsx
// Uma página só, usada tanto para CRIAR (rota /associados/novo)
// quanto para EDITAR (rota /associados/:id) um associado.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

const VAZIO = { nome: '', apelido: '', telefone: '', senha: '', posicao: 'linha', nivel: '' };

export default function AssociadoForm() {
  const { id } = useParams();
  const modoEdicao = !!id;

  const { token } = useAuth();
  const navigate = useNavigate();

  const [dados, setDados] = useState(VAZIO);
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!modoEdicao) return;
    api
      .buscarAssociado(token, id)
      .then((a) =>
        setDados({
          nome: a.nome,
          apelido: a.apelido || '',
          telefone: a.telefone,
          senha: '', // senha nunca vem do backend; deixa em branco = "não alterar"
          posicao: a.posicao,
          nivel: a.nivel ?? '',
        })
      )
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [id, modoEdicao, token]);

  function atualizarCampo(campo, valor) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);

    const payload = {
      nome: dados.nome,
      apelido: dados.apelido || null,
      telefone: dados.telefone,
      posicao: dados.posicao,
      nivel: dados.nivel === '' ? null : Number(dados.nivel),
    };
    // só manda senha se o admin realmente digitou uma nova
    if (dados.senha) payload.senha = dados.senha;

    try {
      if (modoEdicao) {
        await api.editarAssociado(token, id, payload);
      } else {
        if (!dados.senha) throw new Error('Defina uma senha para o novo associado.');
        await api.criarAssociado(token, payload);
      }
      navigate('/');
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="pagina">Carregando...</p>;

  return (
    <div className="pagina">
      <h1>{modoEdicao ? 'Editar associado' : 'Novo associado'}</h1>

      <form onSubmit={salvar} className="formulario cartao">
        <label>
          Nome completo
          <input
            value={dados.nome}
            onChange={(e) => atualizarCampo('nome', e.target.value)}
            required
          />
        </label>

        <label>
          Apelido (opcional)
          <input
            value={dados.apelido}
            onChange={(e) => atualizarCampo('apelido', e.target.value)}
          />
        </label>

        <label>
          Telefone
          <input
            value={dados.telefone}
            onChange={(e) => atualizarCampo('telefone', e.target.value)}
            placeholder="75988887777"
            required
          />
        </label>

        <label>
          {modoEdicao ? 'Nova senha (deixe em branco para manter)' : 'Senha (mínimo 6 caracteres)'}
          <input
            type="password"
            value={dados.senha}
            onChange={(e) => atualizarCampo('senha', e.target.value)}
            minLength={modoEdicao ? undefined : 6}
          />
        </label>

        <label>
          Posição
          <select value={dados.posicao} onChange={(e) => atualizarCampo('posicao', e.target.value)}>
            <option value="linha">Linha</option>
            <option value="goleiro">Goleiro</option>
            <option value="ambos">Ambos</option>
          </select>
        </label>

        <label>
          Nível (opcional, usado no sorteio de times no futuro)
          <input
            type="number"
            value={dados.nivel}
            onChange={(e) => atualizarCampo('nivel', e.target.value)}
          />
        </label>

        <Alerta tipo="erro">{erro}</Alerta>

        <div className="acoes-formulario">
          <button className="btn btn-primario" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            className="btn btn-secundario"
            type="button"
            onClick={() => navigate('/')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
