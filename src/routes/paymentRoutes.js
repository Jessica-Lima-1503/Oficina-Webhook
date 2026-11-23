const express = require('express');
const { STATUS_VALIDOS } = require('../store/paymentStore');

function criarRotasPagamento(store) {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    const { cliente, valor } = req.body || {};
    if (typeof cliente !== 'string' || !cliente.trim() || cliente.trim().length > 255) {
      return res.status(400).json({ erro: 'Informe um nome de cliente com até 255 caracteres.' });
    }
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > 99999999.99) {
      return res.status(400).json({ erro: 'Informe um valor numérico maior que zero e dentro do limite permitido.' });
    }
    if (Math.round(valor * 100) !== valor * 100) {
      return res.status(400).json({ erro: 'O valor deve possuir no máximo duas casas decimais.' });
    }
    try {
      const pagamento = await store.criarPagamento(cliente.trim(), valor);
      return res.status(201).json({ mensagem: 'Cobrança criada com sucesso.', pagamento });
    } catch (error) { return next(error); }
  });

  router.get('/', async (req, res, next) => {
    const { status } = req.query;
    if (status && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` });
    }
    try {
      const pagamentos = await store.listarPagamentos(status);
      return res.json({ total: pagamentos.length, pagamentos });
    } catch (error) { return next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const pagamento = await store.buscarPagamento(req.params.id);
      if (!pagamento) return res.status(404).json({ erro: 'Pagamento não encontrado.' });
      return res.json({ pagamento });
    } catch (error) { return next(error); }
  });
  return router;
}
module.exports = criarRotasPagamento;
