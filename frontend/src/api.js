// src/api.js
// Um único lugar que sabe conversar com o backend.
// Toda a tela usa essa função em vez de chamar fetch() espalhado pelo código.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // O backend sempre devolve JSON, mesmo em erro (ex: { erro: '...' })
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const mensagem = dados.erro || `Erro ${resposta.status} ao chamar ${path}`;
    throw new Error(mensagem);
  }

  return dados;
}

export const api = {
  // ---- auth ----
  loginAdmin: (telefone, senha) =>
    request('/api/auth/admin/login', { method: 'POST', body: { telefone, senha } }),
  loginAssociado: (telefone, senha) =>
    request('/api/auth/associado/login', { method: 'POST', body: { telefone, senha } }),

  // ---- admins ----
  criarPrimeiroAdmin: (nome, telefone, senha) =>
    request('/api/admins', { method: 'POST', body: { nome, telefone, senha } }),
  criarAdmin: (token, nome, telefone, senha) =>
    request('/api/admins', { method: 'POST', body: { nome, telefone, senha }, token }),
  listarAdmins: (token) => request('/api/admins', { token }),

  // ---- associados ----
  listarAssociados: (token, ativo) => {
    const query = ativo === undefined ? '' : `?ativo=${ativo}`;
    return request(`/api/associados${query}`, { token });
  },
  buscarAssociado: (token, id) => request(`/api/associados/${id}`, { token }),
  buscarMeuPerfil: (token) => request('/api/associados/me', { token }),
  criarAssociado: (token, dados) =>
    request('/api/associados', { method: 'POST', body: dados, token }),
  editarAssociado: (token, id, dados) =>
    request(`/api/associados/${id}`, { method: 'PUT', body: dados, token }),
  alterarPagamento: (token, id, status) =>
    request(`/api/associados/${id}/pagamento`, { method: 'PATCH', body: { status }, token }),
  desativarAssociado: (token, id) =>
    request(`/api/associados/${id}/desativar`, { method: 'PATCH', token }),
  reativarAssociado: (token, id) =>
    request(`/api/associados/${id}/reativar`, { method: 'PATCH', token }),
  excluirAssociado: (token, id) =>
    request(`/api/associados/${id}`, { method: 'DELETE', token }),

  // ---- dias de baba ----
  listarDiasBaba: (token) => request('/api/dias-baba', { token }),
  buscarDiaBaba: (token, id) => request(`/api/dias-baba/${id}`, { token }),
  criarDiaBaba: (token, dados) =>
    request('/api/dias-baba', { method: 'POST', body: dados, token }),
  ajustarPresentes: (token, id, dados) =>
    request(`/api/dias-baba/${id}/presentes`, { method: 'PATCH', body: dados, token }),
  sortearTimes: (token, id, formato) =>
    request(`/api/dias-baba/${id}/sorteio`, { method: 'POST', body: { formato }, token }),
  definirSuplente: (token, id, escalacaoId, ehSuplenteParaTimeId) =>
    request(`/api/dias-baba/${id}/escalacoes/${escalacaoId}/suplente`, {
      method: 'PATCH',
      body: { eh_suplente_para_time_id: ehSuplenteParaTimeId },
      token,
    }),
  criarPartida: (token, id, timeAId, timeBId) =>
    request(`/api/dias-baba/${id}/partidas`, {
      method: 'POST',
      body: { time_a_id: timeAId, time_b_id: timeBId },
      token,
    }),
  registrarPlacar: (token, id, partidaId, dados) =>
    request(`/api/dias-baba/${id}/partidas/${partidaId}`, { method: 'PUT', body: dados, token }),
  removerPartida: (token, id, partidaId) =>
    request(`/api/dias-baba/${id}/partidas/${partidaId}`, { method: 'DELETE', token }),
  finalizarDiaBaba: (token, id) =>
    request(`/api/dias-baba/${id}/finalizar`, { method: 'PATCH', body: {}, token }),

  // ---- desempenhos ----
  buscarDesempenhos: (token, { periodo, ano, mes } = {}) => {
    const params = new URLSearchParams({ periodo: periodo || 'mensal', ano: ano || new Date().getFullYear() });
    if (periodo !== 'anual' && mes) params.set('mes', mes);
    return request(`/api/desempenhos?${params.toString()}`, { token });
  },
  buscarRanking: (token, { tipo, periodo, ano, mes } = {}) => {
    const params = new URLSearchParams({
      tipo: tipo || 'pontuacao',
      periodo: periodo || 'mensal',
      ano: ano || new Date().getFullYear(),
    });
    if (periodo !== 'anual' && mes) params.set('mes', mes);
    return request(`/api/desempenhos/ranking?${params.toString()}`, { token });
  },
};
