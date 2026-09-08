const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ mensagem: 'API do App de Finanças Online e Rodando!' });
});

// Rota para o Coolify saber que a aplicação está viva (Healthcheck)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});