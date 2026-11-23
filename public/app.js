const form = document.querySelector('#payment-form');
const createButton = document.querySelector('#create-button');
const simulateButton = document.querySelector('#simulate-button');
const emptyState = document.querySelector('#empty-state');
const paymentResult = document.querySelector('#payment-result');
const formMessage = document.querySelector('#form-message');
const resultMessage = document.querySelector('#result-message');
const listMessage = document.querySelector('#list-message');
const statusFilter = document.querySelector('#status-filter');
let pagamentoAtual = null;
let toastTimer;

const statusLabels = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', cancelled: 'Cancelado' };
const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const showMessage = (element, message, type = '') => { element.textContent = message; element.className = `message ${type}`; };
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message; element.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
}
async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a operação.');
  return data;
}
function renderPayment(payment) {
  pagamentoAtual = payment;
  emptyState.hidden = true; paymentResult.hidden = false;
  document.querySelector('#result-client').textContent = payment.cliente;
  document.querySelector('#result-amount').textContent = money(payment.valor);
  document.querySelector('#payment-id').textContent = payment.id;
  const status = document.querySelector('#status');
  status.textContent = statusLabels[payment.status] || payment.status;
  status.className = `status ${payment.status}`;
  document.querySelector('#simulated-status').value = payment.status === 'pending' ? 'approved' : 'approved';
}
function updateStats(payments) {
  document.querySelector('#stat-total').textContent = payments.length;
  document.querySelector('#stat-pending').textContent = payments.filter(p => p.status === 'pending').length;
  document.querySelector('#stat-approved').textContent = payments.filter(p => p.status === 'approved').length;
  document.querySelector('#stat-volume').textContent = money(payments.reduce((sum, p) => sum + Number(p.valor), 0));
}
async function loadPayments() {
  const query = statusFilter.value ? `?status=${encodeURIComponent(statusFilter.value)}` : '';
  try {
    const data = await api(`/pagamentos${query}`);
    const tbody = document.querySelector('#payments-list');
    tbody.replaceChildren();
    if (!data.pagamentos.length) {
      const row = document.createElement('tr'); const cell = document.createElement('td');
      cell.colSpan = 5; cell.className = 'table-empty'; cell.textContent = 'Nenhuma cobrança encontrada para este filtro.';
      row.append(cell); tbody.append(row);
    } else {
      data.pagamentos.forEach(payment => {
        const row = document.createElement('tr');
        const client = document.createElement('td'); client.textContent = payment.cliente; row.append(client);
        const amount = document.createElement('td'); amount.textContent = money(payment.valor); row.append(amount);
        const statusCell = document.createElement('td'); const badge = document.createElement('span');
        badge.className = `status table-status ${payment.status}`; badge.textContent = statusLabels[payment.status]; statusCell.append(badge); row.append(statusCell);
        const idCell = document.createElement('td'); idCell.className = 'id-short'; idCell.textContent = `${payment.id.slice(0, 8)}…`; row.append(idCell);
        const actionCell = document.createElement('td'); const button = document.createElement('button');
        button.className = 'view-button'; button.type = 'button'; button.textContent = 'Ver detalhes ↗';
        button.addEventListener('click', async () => {
          try { const latest = await api(`/pagamentos/${payment.id}`); renderPayment(latest.pagamento); showMessage(resultMessage, 'Registro consultado diretamente no MySQL.', 'success'); document.querySelector('#details-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          catch (error) { showMessage(listMessage, error.message, 'error'); }
        });
        actionCell.append(button); row.append(actionCell); tbody.append(row);
      });
    }
    // O resumo geral não depende do filtro ativo.
    const all = statusFilter.value ? await api('/pagamentos') : data;
    updateStats(all.pagamentos);
    showMessage(listMessage, `${data.total} registro(s) encontrado(s).`, '');
  } catch (error) { showMessage(listMessage, error.message, 'error'); }
}

form.addEventListener('submit', async event => {
  event.preventDefault(); showMessage(formMessage, '');
  const cliente = form.cliente.value.trim(); const valor = Number(form.valor.value);
  if (!cliente || !Number.isFinite(valor) || valor <= 0) { showMessage(formMessage, 'Informe o nome do cliente e um valor maior que zero.', 'error'); return; }
  createButton.disabled = true; createButton.innerHTML = '<span>Salvando cobrança...</span><span>…</span>';
  try {
    const data = await api('/pagamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente, valor }) });
    renderPayment(data.pagamento); showMessage(formMessage, data.mensagem, 'success');
    showMessage(resultMessage, 'Cobrança criada e persistida no MySQL.', 'success');
    form.reset(); toast('Cobrança criada com sucesso.'); await loadPayments();
  } catch (error) { showMessage(formMessage, error.message, 'error'); }
  finally { createButton.disabled = false; createButton.innerHTML = '<span>Criar cobrança</span><span class="button-arrow">↗</span>'; }
});

simulateButton.addEventListener('click', async () => {
  if (!pagamentoAtual) return;
  simulateButton.disabled = true;
  try {
    const data = await api('/webhook/simular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagamentoId: pagamentoAtual.id, status: document.querySelector('#simulated-status').value, eventoId: crypto.randomUUID() }) });
    if (data.pagamento) renderPayment(data.pagamento);
    showMessage(resultMessage, data.mensagem, 'success'); toast('Notificação registrada. Status atualizado.'); await loadPayments();
  } catch (error) { showMessage(resultMessage, error.message, 'error'); }
  finally { simulateButton.disabled = false; }
});

document.querySelector('#copy-id').addEventListener('click', async () => {
  if (!pagamentoAtual) return;
  try { await navigator.clipboard.writeText(pagamentoAtual.id); toast('Identificador copiado.'); }
  catch { showMessage(resultMessage, 'Não foi possível copiar automaticamente.', 'error'); }
});
statusFilter.addEventListener('change', loadPayments);
loadPayments();
