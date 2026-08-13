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
  desativarAssociado: (token, id) =>
    request(`/api/associados/${id}/desativar`, { method: 'PATCH', token }),
  reativarAssociado: (token, id) =>
    request(`/api/associados/${id}/reativar`, { method: 'PATCH', token }),
  excluirAssociado: (token, id) =>
    request(`/api/associados/${id}`, { method: 'DELETE', token }),
};
