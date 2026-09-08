const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// O segredo do token (pegamos do Coolify ou usamos um padrão de segurança mínimo)
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-temporaria-123';

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 1. Rota de Cadastro
app.post('/auth/register', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const hashSenha = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { email, senha: hashSenha }
    });
    res.status(201).json({ sucesso: true, mensagem: "Usuário criado com sucesso!", id: usuario.id });
  } catch (erro) {
    console.error(erro);
    res.status(400).json({ sucesso: false, erro: "Falha ao criar usuário. O e-mail já existe?" });
  }
});

// 2. Rota de Login
app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ sucesso: false, erro: "E-mail ou senha incorretos" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ sucesso: false, erro: "E-mail ou senha incorretos" });
    }

    // Gera o token válido por 7 dias
    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ sucesso: true, token });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor" });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});