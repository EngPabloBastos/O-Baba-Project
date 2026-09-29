// lib/fotos.js
// Onde e como as fotos de perfil são salvas em disco. Usa a MESMA pasta do banco
// (DB_PATH) como base, então em produção elas ficam no mesmo volume persistente já
// configurado para o SQLite — sem precisar montar outro volume.

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const caminhoBanco = process.env.DB_PATH || path.join(__dirname, '..', 'associacao.db');
const PASTA_UPLOADS = path.join(path.dirname(caminhoBanco), 'uploads');
const PASTA_FOTOS = path.join(PASTA_UPLOADS, 'fotos');
fs.mkdirSync(PASTA_FOTOS, { recursive: true });

const EXTENSAO_POR_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const TAMANHO_MAXIMO = 3 * 1024 * 1024; // 3MB

const armazenamento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_FOTOS),
  filename: (req, file, cb) => {
    const ext = EXTENSAO_POR_MIME[file.mimetype] || '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: armazenamento,
  limits: { fileSize: TAMANHO_MAXIMO },
  fileFilter: (req, file, cb) => {
    if (!EXTENSAO_POR_MIME[file.mimetype]) {
      return cb(new Error('Envie uma imagem JPEG, PNG ou WebP.'));
    }
    cb(null, true);
  },
});

// Middleware pronto pra rota: já trata erro do multer (tamanho/tipo) com uma
// resposta JSON amigável, em vez de cair no handler genérico de erro 500.
function receberFoto(req, res, next) {
  upload.single('foto')(req, res, (err) => {
    if (err) {
      const mensagem = err.code === 'LIMIT_FILE_SIZE' ? 'A imagem precisa ter até 3MB.' : err.message;
      return res.status(400).json({ erro: mensagem || 'Não foi possível enviar a imagem.' });
    }
    if (!req.file) {
      return res.status(400).json({ erro: 'Envie uma imagem no campo "foto".' });
    }
    next();
  });
}

// Apaga o arquivo de uma foto antiga (ex: ao trocar ou remover). Ignora se já não existir.
function removerArquivo(fotoUrl) {
  if (!fotoUrl) return;
  const arquivo = path.join(PASTA_UPLOADS, fotoUrl.replace(/^\/uploads\//, ''));
  fs.unlink(arquivo, () => {}); // melhor esforço; não precisa travar a resposta por isso
}

module.exports = { PASTA_UPLOADS, PASTA_FOTOS, receberFoto, removerArquivo };
