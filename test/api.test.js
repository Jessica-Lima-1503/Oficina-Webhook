const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { criarApp } = require('../src/app');

function criarStoreFake() {
  const pagamentos = new Map(); const eventos = new Set();
  return {
    async criarPagamento(cliente, valor) {
      const pagamento = { id: crypto.randomUUID(), cliente, valor, status: 'pending', criadoEm: new Date().toISOString(), atualizadoEm: null };
      pagamentos.set(pagamento.id, pagamento); return { ...pagamento };
    },
    async buscarPagamento(id) { const p = pagamentos.get(id); return p ? { ...p } : null; },
    async listarPagamentos(status) { return [...pagamentos.values()].filter(p => !status || p.status === status).map(p => ({ ...p })); },
    async processarEvento({ pagamentoId, status, eventoId }) {
      const p = pagamentos.get(pagamentoId);
      if (!p) return { encontrado: false };
      if (eventos.has(eventoId)) return { duplicado: true };
      eventos.add(eventoId); p.status = status; p.atualizadoEm = new Date().toISOString();
      return { duplicado: false, pagamento: { ...p } };
    }
  };
}

async function setup() {
  const app = criarApp({ store: criarStoreFake(), webhookToken: 'teste-seguro' });
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, options = {}) {
    const response = await fetch(`${base}${path}`, options);
    return { status: response.status, body: await response.json() };
  }
  return { request, close: () => new Promise(resolve => server.close(resolve)) };
}
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('cria cobrança e consulta pelo identificador', async t => {
  const api = await setup(); t.after(api.close);
  const created = await api.request('/pagamentos', json({ cliente: 'Ana Silva', valor: 49.9 }));
  assert.equal(created.status, 201); assert.equal(created.body.pagamento.status, 'pending');
  const found = await api.request(`/pagamentos/${created.body.pagamento.id}`);
  assert.equal(found.status, 200); assert.equal(found.body.pagamento.cliente, 'Ana Silva');
});

test('lista pagamentos e filtra pelo status', async t => {
  const api = await setup(); t.after(api.close);
  await api.request('/pagamentos', json({ cliente: 'Bia', valor: 20 }));
  const result = await api.request('/pagamentos?status=pending');
  assert.equal(result.status, 200); assert.equal(result.body.total, 1);
});

test('atualiza status com webhook autenticado', async t => {
  const api = await setup(); t.after(api.close);
  const created = await api.request('/pagamentos', json({ cliente: 'Caio', valor: 30 }));
  const id = created.body.pagamento.id;
  const updated = await api.request('/webhook/pagamento', { ...json({ pagamentoId: id, status: 'approved', eventoId: 'evt-001' }), headers: { 'Content-Type': 'application/json', 'x-webhook-token': 'teste-seguro' } });
  assert.equal(updated.status, 200); assert.equal(updated.body.pagamento.status, 'approved');
});

test('não processa duas vezes o mesmo evento', async t => {
  const api = await setup(); t.after(api.close);
  const created = await api.request('/pagamentos', json({ cliente: 'Dani', valor: 15 }));
  const body = { pagamentoId: created.body.pagamento.id, status: 'approved', eventoId: 'evt-duplicado' };
  const first = await api.request('/webhook/simular', json(body));
  const second = await api.request('/webhook/simular', json(body));
  assert.equal(first.body.duplicado, false); assert.equal(second.body.duplicado, true);
});

test('rejeita dados inválidos e token incorreto', async t => {
  const api = await setup(); t.after(api.close);
  const invalid = await api.request('/pagamentos', json({ cliente: ' ', valor: -1 }));
  assert.equal(invalid.status, 400);
  const noToken = await api.request('/webhook/pagamento', json({ pagamentoId: 'x', status: 'approved', eventoId: 'evt-x' }));
  assert.equal(noToken.status, 401);
  const invalidStatus = await api.request('/webhook/simular', json({ pagamentoId: 'x', status: 'pending', eventoId: 'evt-y' }));
  assert.equal(invalidStatus.status, 400);
});
