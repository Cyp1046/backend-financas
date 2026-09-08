const express = require('express');
const { PrismaClient } = require('@prisma/client'); // Importa o Prisma

const app = express();
const prisma = new PrismaClient(); // Inicia a conexão
const port = process.env.PORT || 3000;

app.use(express.json());

// Rota de Healthcheck (para o Coolify saber que está vivo)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Rota para CRIAR um dado de teste no banco
app.post('/testar-banco', async (req, res) => {
  try {
    const novaMensagem = await prisma.testeConexao.create({
      data: {
        mensagem: "Olá, Banco de Dados! Eu vim da API."
      }
    });
    res.json({ sucesso: true, dado: novaMensagem });
  } catch (erro) {
    console.error("Erro ao salvar no banco:", erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// Rota para LER os dados do banco
app.get('/testar-banco', async (req, res) => {
  try {
    const mensagens = await prisma.testeConexao.findMany();
    res.json({ sucesso: true, dados: mensagens });
  } catch (erro) {
    console.error("Erro ao ler do banco:", erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});