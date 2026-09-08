const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-temporaria-123';

app.use(express.json());

// Rota de Healthcheck
app.get('/health', (req, res) => res.status(200).send('OK'));

// ==========================
// ROTAS DE AUTENTICAÇÃO
// ==========================
app.post('/auth/register', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const hashSenha = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({ data: { email, senha: hashSenha } });
    res.status(201).json({ sucesso: true, id: usuario.id });
  } catch (erro) {
    res.status(400).json({ sucesso: false, erro: "Falha ao criar usuário." });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ sucesso: false, erro: "Credenciais inválidas" });
    }
    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ sucesso: true, token });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: "Erro interno" });
  }
});

// ==========================
// PORTEIRO (MIDDLEWARE)
// ==========================
const verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ erro: "Token não fornecido" });

  // Remove a palavra "Bearer " se ela vier junto no cabeçalho
  const tokenLimpo = token.replace('Bearer ', '');

  jwt.verify(tokenLimpo, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ erro: "Token inválido ou expirado" });
    req.usuarioId = decoded.id; // Salva o ID do usuário para usar nas rotas
    next();
  });
};

// ==========================
// ROTAS PROTEGIDAS (NEGÓCIO)
// ==========================

// Criar Categoria
app.post('/categorias', verificarToken, async (req, res) => {
  const { nome, icone } = req.body;
  try {
    const categoria = await prisma.categoria.create({
      data: { nome, icone }
    });
    res.status(201).json(categoria);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao criar categoria" });
  }
});

// Listar Categorias
app.get('/categorias', verificarToken, async (req, res) => {
  const categorias = await prisma.categoria.findMany();
  res.json(categorias);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});