const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(express.json());

// Rota de Healthcheck (para o Coolify manter o app online)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Rota inicial provisória
app.get('/', (req, res) => {
  res.json({ mensagem: "API de Finanças operando com o novo banco de dados!" });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});