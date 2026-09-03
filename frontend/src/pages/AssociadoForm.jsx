// src/pages/AssociadoForm.jsx
// Uma página só, usada tanto para CRIAR (rota /associados/novo)
// quanto para EDITAR (rota /associados/:id) um associado.
// O status de pagamento não é editado aqui: ele tem sua ação própria na lista
// de associados, para deixar claro que é uma ação separada do cadastro.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Botao, Campo, Cartao, Secao, Titulo } from '../components/ui.jsx';

const VAZIO = { nome: '', apelido: '', telefone: '', senha: '' };

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

  if (carregando) return <p className="px-container-padding pt-md text-body-md text-on-surface-variant">Carregando...</p>;

  return (
    <div className="flex flex-col w-full pb-20">
      <Secao className="flex-row items-center gap-sm pt-lg">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface-variant/10 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <Titulo>{modoEdicao ? 'Editar associado' : 'Novo associado'}</Titulo>
      </Secao>

      <Secao>
        <Cartao>
          <form onSubmit={salvar} className="flex flex-col gap-md">
            <Campo
              label="Nome completo"
              icone="person"
              value={dados.nome}
              onChange={(e) => atualizarCampo('nome', e.target.value)}
              required
            />

            <Campo
              label="Apelido (opcional)"
              icone="badge"
              value={dados.apelido}
              onChange={(e) => atualizarCampo('apelido', e.target.value)}
            />

            <Campo
              label="Telefone"
              icone="smartphone"
              value={dados.telefone}
              onChange={(e) => atualizarCampo('telefone', e.target.value)}
              placeholder="75988887777"
              required
            />

            <Campo
              label={modoEdicao ? 'Nova senha (deixe em branco para manter)' : 'Senha (mínimo 6 caracteres)'}
              icone="lock"
              type="password"
              value={dados.senha}
              onChange={(e) => atualizarCampo('senha', e.target.value)}
              minLength={modoEdicao ? undefined : 6}
            />

            <Alerta tipo="erro">{erro}</Alerta>

            <div className="flex gap-sm mt-sm">
              <Botao variante="primario" type="submit" disabled={salvando} className="flex-1">
                {salvando ? 'Salvando...' : 'Salvar'}
              </Botao>
              <Botao variante="secundario" type="button" onClick={() => navigate('/')}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Cartao>
      </Secao>
    </div>
  );
}

