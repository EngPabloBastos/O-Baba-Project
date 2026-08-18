// src/pages/DiaBabaForm.jsx
// Criação de um novo Dia de Baba: data, associados presentes (checklist) e
// convidados presentes (um nome por linha). O sorteio dos times acontece
// depois, na tela de detalhe, para o admin poder revisar a lista de presentes antes.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

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

  if (carregando) return <p className="pagina">Carregando...</p>;

  return (
    <div className="pagina">
      <h1>Novo Dia de Baba</h1>

      <form onSubmit={salvar} className="formulario cartao">
        <label>
          Data da partida
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>

        <label>
          Associados presentes ({selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'})
          <div className="checklist">
            {associados.length === 0 && <p className="texto-auxiliar">Nenhum associado ativo cadastrado.</p>}
            {associados.map((a) => (
              <label key={a.id}>
                <input
                  type="checkbox"
                  checked={selecionados.has(a.id)}
                  onChange={() => alternar(a.id)}
                />
                {a.apelido || a.nome}
              </label>
            ))}
          </div>
        </label>

        <label>
          Convidados presentes (um nome por linha, opcional)
          <textarea
            rows={4}
            value={convidadosTexto}
            onChange={(e) => setConvidadosTexto(e.target.value)}
            placeholder={'Ex: João Vizinho\nMarcos do trabalho'}
          />
        </label>

        <Alerta tipo="erro">{erro}</Alerta>

        <div className="acoes-formulario">
          <button className="btn btn-primario" type="submit" disabled={salvando}>
            {salvando ? 'Criando...' : 'Criar Dia de Baba'}
          </button>
          <button className="btn btn-secundario" type="button" onClick={() => navigate('/dias-baba')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
