// src/pages/DiaBabaForm.jsx
// Criação de um novo Dia de Baba: data, associados presentes (checklist) e
// convidados presentes (um nome por linha). O sorteio dos times acontece
// depois, na tela de detalhe, para o admin poder revisar a lista de presentes antes.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';
import { Avatar, Botao, Campo, Cartao, Secao, Titulo } from '../components/ui.jsx';

export default function DiaBabaForm() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [associados, setAssociados] = useState([]);
  const [selecionados, setSelecionados] = useState(new Set());
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [convidadosTexto, setConvidadosTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .listarAssociados(token, '1')
      .then(setAssociados)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token]);

  function alternar(id) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');

    const convidados_presentes = convidadosTexto
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean);

    if (selecionados.size + convidados_presentes.length === 0) {
      setErro('Selecione ao menos um associado ou informe um convidado presente.');
      return;
    }

    setSalvando(true);
    try {
      const dia = await api.criarDiaBaba(token, {
        data,
        associados_presentes: [...selecionados],
        convidados_presentes,
      });
      navigate(`/dias-baba/${dia.id}`);
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
          onClick={() => navigate('/dias-baba')}
          className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface-variant/10 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <Titulo>Novo Dia de Baba</Titulo>
      </Secao>

      <form onSubmit={salvar} className="flex flex-col gap-md">
        <Secao className="pt-0">
          <Campo label="Data da partida" icone="calendar_today" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </Secao>

        <Secao className="pt-0">
          <span className="font-label-sm text-label-sm text-on-surface-variant ml-1">
            Associados presentes ({selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'})
          </span>
          <Cartao className="max-h-72 overflow-y-auto p-0 divide-y divide-outline-variant/30">
            {associados.length === 0 && (
              <p className="text-body-md text-on-surface-variant p-md">Nenhum associado ativo cadastrado.</p>
            )}
            {associados.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-md px-md py-sm cursor-pointer active:bg-surface-variant/30"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(a.id)}
                  onChange={() => alternar(a.id)}
                  className="w-5 h-5 accent-primary shrink-0"
                />
                <Avatar nome={a.apelido || a.nome} tamanho={36} tom={selecionados.has(a.id) ? 'verde' : 'neutro'} />
                <span className="font-body-md text-on-surface truncate">{a.apelido || a.nome}</span>
              </label>
            ))}
          </Cartao>
        </Secao>

        <Secao className="pt-0">
          <Campo
            as="textarea"
            label="Convidados presentes (um nome por linha, opcional)"
            rows={4}
            value={convidadosTexto}
            onChange={(e) => setConvidadosTexto(e.target.value)}
            placeholder={'Ex: João Vizinho\nMarcos do trabalho'}
            className="resize-none"
          />
        </Secao>

        <Secao className="pt-0">
          <Alerta tipo="erro">{erro}</Alerta>

          <div className="flex gap-sm">
            <Botao variante="primario" type="submit" disabled={salvando} className="flex-1">
              {salvando ? 'Criando...' : 'Criar Dia de Baba'}
            </Botao>
            <Botao variante="secundario" type="button" onClick={() => navigate('/dias-baba')}>
              Cancelar
            </Botao>
          </div>
        </Secao>
      </form>
    </div>
  );
}

