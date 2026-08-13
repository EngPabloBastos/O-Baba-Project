// middleware/auth.js
// Funções que protegem as rotas, verificando se quem está chamando
// tem um token válido e o papel (role) certo.

const jwt = require('jsonwebtoken');

// Lê o token do header "Authorization: Bearer <token>" e valida.
// Se for válido, guarda os dados do usuário em req.user e deixa passar.
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role: 'admin' | 'associado', nome }
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

// Usa depois de "autenticar" para garantir que só admins passem.
function somenteAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administradores podem fazer isso.' });
  }
  next();
}

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, role: usuario.role, nome: usuario.nome },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { autenticar, somenteAdmin, gerarToken };
