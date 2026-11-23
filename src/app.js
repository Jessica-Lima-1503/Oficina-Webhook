const express = require('express');
const path = require('node:path');
const { criarPaymentStore } = require('./store/paymentStore');
const criarRotasPagamento = require('./routes/paymentRoutes');
const criarRotasWebhook = require('./routes/webhookRoutes');

function criarApp({ store = criarPaymentStore(), webhookToken = process.env.WEBHOOK_TOKEN } = {}) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/api/health', (req, res) => res.json({ status: 'online', ambiente: 'demonstracao' }));
  app.use('/pagamentos', criarRotasPagamento(store));
  app.use('/webhook', criarRotasWebhook(store, webhookToken));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ erro: 'JSON inválido.' });
    }
    console.error('Erro na aplicação:', err.message);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  });
  return app;
}
module.exports = criarApp();
module.exports.criarApp = criarApp;
