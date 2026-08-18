// src/pages/DiasBaba.jsx
// Histórico de todos os Dias de Baba já criados. Visível para admin e associado;
// só o admin vê o botão de criar um novo.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alerta from '../components/Alerta.jsx';

export default function DiasBaba() {
  const { token, isAdmin } = useAuth();
  const [dias, setDias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .listarDiasBaba(token)
      .then(setDias)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token]);

  return (
    <div className="pagina">
      <div className="cabecalho-pagina">
        <h1>Dia de Baba</h1>
        {isAdmin && (
          <Link to="/dias-baba/novo" className="btn btn-primario">
            + Novo Dia de Baba
          </Link>
        )}
      </div>

      <Alerta tipo="erro">{erro}</Alerta>

      {carregando ? (
        <p>Carregando...</p>
      ) : dias.length === 0 ? (
        <p className="texto-auxiliar">Nenhum Dia de Baba registrado ainda.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Formato</th>
              <th>Presentes</th>
              <th>Partidas</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.id}>
                <td>{new Date(`${d.data}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                <td>{d.formato || '—'}</td>
                <td>{d.total_presentes}</td>
                <td>{d.total_partidas}</td>
                <td>
                  <span className={`etiqueta etiqueta-${d.status}`}>
                    {d.status === 'aberto' ? 'Em andamento' : 'Finalizado'}
                  </span>
                </td>
                <td className="acoes">
                  <Link to={`/dias-baba/${d.id}`} className="btn btn-secundario btn-pequeno">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
