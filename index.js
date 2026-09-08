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

  const tokenLimpo = token.replace('Bearer ', '');

  jwt.verify(tokenLimpo, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ erro: "Token inválido ou expirado" });
    req.usuarioId = decoded.id;
    next();
  });
};

// ==========================
// ROTAS DE CATEGORIAS
// ==========================
app.post('/categorias', verificarToken, async (req, res) => {
  const { nome, icone } = req.body;
  try {
    const categoria = await prisma.categoria.create({ data: { nome, icone } });
    res.status(201).json(categoria);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao criar categoria" });
  }
});

app.get('/categorias', verificarToken, async (req, res) => {
  const categorias = await prisma.categoria.findMany();
  res.json(categorias);
});

// ==========================
// ROTA DE EDIÇÃO DE CATEGORIA (PUT)
// ==========================
app.put('/categorias/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nome, icone } = req.body; 

  try {
    const categoriaAtualizada = await prisma.categoria.update({
      where: { id: id },
      data: { nome, icone }
    });
    
    res.status(200).json(categoriaAtualizada);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao atualizar categoria", detalhe: erro.message });
  }
});

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

// ==========================
// ROTA DE EXCLUSÃO DE CONTA
// ==========================
app.delete('/contas/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.conta.delete({
      where: { id: id }
    });
    
    res.status(200).json({ mensagem: "Conta excluída com sucesso!" });
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao excluir conta", detalhe: erro.message });
  }
});

app.get('/contas', verificarToken, async (req, res) => {
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
  const { descricao, valor, tipo, categoriaId, carteiraId, faturaId, carteiraDestinoId } = req.body;
  
  try {
    const transacao = await prisma.transacao.create({
      data: { descricao, valor, tipo, categoriaId, carteiraId, faturaId, carteiraDestinoId }
    });

    // Cenario A: Compra/Receita no Débito ou Pix
    if (carteiraId && tipo !== 'PAGAMENTO_FATURA' && tipo !== 'TRANSFERENCIA') {
      const operacao = tipo === 'RECEITA' ? { increment: valor } : { decrement: valor };
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: operacao }
      });
    }

    // Cenario B: Compra no Cartão de Crédito
    if (faturaId && tipo === 'DESPESA') {
      await prisma.fatura.update({
        where: { id: faturaId },
        data: { valorTotal: { increment: valor } }
      });
    }

    // Cenario C: Pagamento da Fatura
    if (tipo === 'PAGAMENTO_FATURA' && carteiraId && faturaId) {
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: { decrement: valor } }
      });

      await prisma.fatura.update({
        where: { id: faturaId },
        data: { status: 'PAGA' }
      });
    }

    // Cenario D: Transferência entre Carteiras
    if (tipo === 'TRANSFERENCIA' && carteiraId && carteiraDestinoId) {
      // Tira da carteira de origem
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: { decrement: valor } }
      });

      // Põe na carteira de destino
      await prisma.carteira.update({
        where: { id: carteiraDestinoId },
        data: { saldo: { increment: valor } }
      });
    }

    res.status(201).json(transacao);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao processar transação", detalhe: erro.message });
  }
});

// ==========================
// ROTA: ALTERAR CATEGORIA EM LOTE (BULK UPDATE)
// ==========================
app.put('/transacoes/lote/categoria', verificarToken, async (req, res) => {
  const { transacoesIds, novaCategoriaId } = req.body;

  if (!transacoesIds || !Array.isArray(transacoesIds) || !novaCategoriaId) {
    return res.status(400).json({ erro: "Envie uma lista de 'transacoesIds' e o 'novaCategoriaId'." });
  }

  try {
    const resultado = await prisma.transacao.updateMany({
      where: {
        id: { in: transacoesIds }
      },
      data: {
        categoriaId: novaCategoriaId
      }
    });
    
    res.status(200).json({ 
      mensagem: `${resultado.count} transação(ões) movida(s) para a nova categoria com sucesso!`,
      quantidadeAtualizada: resultado.count
    });
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao atualizar em lote", detalhe: erro.message });
  }
});

// ==========================
// ROTAS DE FATURAS (Cartão de Crédito)
// ==========================
app.post('/faturas', verificarToken, async (req, res) => {
  const { mesReferencia, dataVencimento, contaId } = req.body;
  try {
    const fatura = await prisma.fatura.create({
      data: {
        mesReferencia,
        valorTotal: 0.00,
        dataVencimento: new Date(dataVencimento),
        status: 'ABERTA',
        contaId
      }
    });
    res.status(201).json(fatura);
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao criar fatura", detalhe: erro.message });
  }
});

app.get('/faturas', verificarToken, async (req, res) => {
  const faturas = await prisma.fatura.findMany({ include: { transacoes: true } });
  res.json(faturas);
});

// Inicia o servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});

// ==========================
// ROTA: LISTAR TRANSAÇÕES (EXTRATO)
// ==========================
app.get('/transacoes', verificarToken, async (req, res) => {
  const { carteiraId, faturaId } = req.query;

  try {
    const OndeFiltro = {};
    if (carteiraId) OndeFiltro.carteiraId = carteiraId;
    if (faturaId) OndeFiltro.faturaId = faturaId;

    const transacoes = await prisma.transacao.findMany({
      where: OndeFiltro,
      orderBy: { data: 'desc' },
      include: {
        categoria: true,
        carteira: true,
        fatura: true
      }
    });

    res.json(transacoes);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao buscar transações", detalhe: erro.message });
  }
});

// ==========================
// ROTA: DELETAR TRANSAÇÃO (COM ESTORNO AUTOMÁTICO)
// ==========================
app.delete('/transacoes/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const transacao = await prisma.transacao.findUnique({ where: { id } });

    if (!transacao) {
      return res.status(404).json({ erro: "Transação não encontrada." });
    }

    const { valor, tipo, carteiraId, faturaId, carteiraDestinoId } = transacao;

    // 1. Estorno em Carteira Normal (Débito/Pix)
    if (carteiraId && tipo !== 'PAGAMENTO_FATURA' && tipo !== 'TRANSFERENCIA') {
      const operacaoEstorno = tipo === 'RECEITA' ? { decrement: valor } : { increment: valor };
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: operacaoEstorno }
      });
    }

    // 2. Estorno em Compras no Cartão de Crédito
    if (faturaId && tipo === 'DESPESA') {
      await prisma.fatura.update({
        where: { id: faturaId },
        data: { valorTotal: { decrement: valor } }
      });
    }

    // 3. Estorno de Pagamento de Fatura
    if (tipo === 'PAGAMENTO_FATURA' && carteiraId && faturaId) {
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: { increment: valor } }
      });

      await prisma.fatura.update({
        where: { id: faturaId },
        data: { status: 'ABERTA' }
      });
    }

    // 4. Estorno de Transferência entre Carteiras
    if (tipo === 'TRANSFERENCIA' && carteiraId && carteiraDestinoId) {
      await prisma.carteira.update({
        where: { id: carteiraId },
        data: { saldo: { increment: valor } }
      });

      await prisma.carteira.update({
        where: { id: carteiraDestinoId },
        data: { saldo: { decrement: valor } }
      });
    }

    // Apaga a transação após reverter o saldo
    await prisma.transacao.delete({ where: { id } });

    res.json({ mensagem: "Transação excluída e saldos estornados com sucesso!" });
  } catch (erro) {
    res.status(400).json({ erro: "Erro ao excluir transação", detalhe: erro.message });
  }
});