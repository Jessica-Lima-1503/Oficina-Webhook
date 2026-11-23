const express = require('express');
const { STATUS_FINAIS } = require('../store/paymentStore');

function criarRotasWebhook(store, webhookToken) {
  const router = express.Router();

  async function receberEvento(req, res, next) {
    const { pagamentoId, status, eventoId } = req.body || {};
    if (typeof pagamentoId !== 'string' || !pagamentoId.trim() ||
        typeof eventoId !== 'string' || !eventoId.trim() || eventoId.trim().length > 100 ||
        typeof status !== 'string' || !STATUS_FINAIS.includes(status)) {
      return res.status(400).json({
        erro: 'Informe pagamentoId, eventoId e status válido (approved, rejected ou cancelled).'
      });
    }
    try {
      const resultado = await store.processarEvento({
        pagamentoId: pagamentoId.trim(), status, eventoId: eventoId.trim()
      });
      if (resultado.encontrado === false) return res.status(404).json({ erro: 'Pagamento não encontrado.' });
      if (resultado.duplicado) {
        return res.status(200).json({ mensagem: 'Evento já processado anteriormente.', duplicado: true });
      }
      return res.status(200).json({ mensagem: 'Webhook processado com sucesso.', duplicado: false, pagamento: resultado.pagamento });
    } catch (error) { return next(error); }
  }

  router.post('/pagamento', (req, res, next) => {
    if (!webhookToken || req.get('x-webhook-token') !== webhookToken) {
      return res.status(401).json({ erro: 'Token do webhook inválido.' });
    }
    return receberEvento(req, res, next);
  });

  // Rota didática: usada pelo botão da interface para simular um provedor de pagamentos.
  router.post('/simular', (req, res, next) => receberEvento(req, res, next));
  return router;
}
module.exports = criarRotasWebhook;
