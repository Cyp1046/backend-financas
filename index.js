// ==========================
// ROTAS DE CONTAS
// ==========================
app.post('/contas', verificarToken, async (req, res) => {
  const { nome, instituicao } = req.body;
  try {
    const conta = await prisma.conta.create({ data: { nome, instituicao } });
    res.status(201).json(conta);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao criar conta" });
  }
});

app.get('/contas', verificarToken, async (req, res) => {
  // O "include" já traz as carteiras atreladas a essa conta!
  const contas = await prisma.conta.findMany({ include: { carteiras: true } });
  res.json(contas);
});

// ==========================
// ROTAS DE CARTEIRAS
// ==========================
app.post('/carteiras', verificarToken, async (req, res) => {
  const { nome, tipo, saldo, contaId } = req.body;
  try {
    const carteira = await prisma.carteira.create({
      data: { nome, tipo, saldo, contaId }
    });
    res.status(201).json(carteira);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao criar carteira" });
  }
});

// ==========================
// ROTAS DE TRANSAÇÕES
// ==========================
app.post('/transacoes', verificarToken, async (req, res) => {
  const { descricao, valor, tipo, categoriaId, carteiraId } = req.body;
  
  try {
    // 1. Cria a transação no banco
    const transacao = await prisma.transacao.create({
      data: { descricao, valor, tipo, categoriaId, carteiraId }
    });

    // 2. Atualiza o saldo da Carteira automaticamente
    if (carteiraId) {
      // Se for receita, soma. Se for despesa, subtrai.
      const operacao = tipo === 'RECEITA' ? { increment: valor } : { decrement: valor };
      
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: operacao }
      });
    }

    res.status(201).json(transacao);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao processar transação", detalhe: erro.message });
  }
});