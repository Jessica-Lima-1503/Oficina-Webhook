require('dotenv').config();
const app = require('./src/app');
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log(`Oficina de Webhook disponível em http://localhost:${port}`));

async function encerrar() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
