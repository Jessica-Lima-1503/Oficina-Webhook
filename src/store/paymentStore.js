const crypto = require('node:crypto');
const { getPool } = require('../config/database');

const STATUS_VALIDOS = ['pending', 'approved', 'rejected', 'cancelled'];
const STATUS_FINAIS = STATUS_VALIDOS.filter(status => status !== 'pending');

function mapearPagamento(row) {
  if (!row) return null;
  return {
    id: row.id,
    cliente: row.cliente,
    valor: Number(row.valor),
    status: row.status,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em || null
  };
}

function criarPaymentStore(poolProvider = getPool) {
  return {
    async criarPagamento(cliente, valor) {
      const id = crypto.randomUUID();
      const pool = poolProvider();
      await pool.execute(
        `INSERT INTO pagamentos (id, cliente, valor, status, criado_em)
         VALUES (?, ?, ?, 'pending', UTC_TIMESTAMP(3))`, [id, cliente, valor]
      );
      const [rows] = await pool.execute('SELECT * FROM pagamentos WHERE id = ?', [id]);
      return mapearPagamento(rows[0]);
    },

    async buscarPagamento(id) {
      const [rows] = await poolProvider().execute('SELECT * FROM pagamentos WHERE id = ?', [id]);
      return mapearPagamento(rows[0]);
    },

    async listarPagamentos(status) {
      let sql = 'SELECT * FROM pagamentos';
      const params = [];
      if (status) { sql += ' WHERE status = ?'; params.push(status); }
      sql += ' ORDER BY criado_em DESC';
      const [rows] = await poolProvider().execute(sql, params);
      return rows.map(mapearPagamento);
    },

    async processarEvento({ pagamentoId, status, eventoId }) {
      const connection = await poolProvider().getConnection();
      try {
        await connection.beginTransaction();
        const [pagamentos] = await connection.execute(
          'SELECT * FROM pagamentos WHERE id = ? FOR UPDATE', [pagamentoId]
        );
        if (!pagamentos.length) {
          await connection.rollback();
          return { encontrado: false };
        }
        try {
          await connection.execute(
            `INSERT INTO eventos_webhook (evento_id, pagamento_id, status_recebido, recebido_em)
             VALUES (?, ?, ?, UTC_TIMESTAMP(3))`, [eventoId, pagamentoId, status]
          );
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            await connection.rollback();
            return { duplicado: true };
          }
          throw error;
        }
        await connection.execute(
          'UPDATE pagamentos SET status = ?, atualizado_em = UTC_TIMESTAMP(3) WHERE id = ?',
          [status, pagamentoId]
        );
        const [atualizados] = await connection.execute('SELECT * FROM pagamentos WHERE id = ?', [pagamentoId]);
        await connection.commit();
        return { duplicado: false, pagamento: mapearPagamento(atualizados[0]) };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = { criarPaymentStore, STATUS_VALIDOS, STATUS_FINAIS };
