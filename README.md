# Oficina de Webhook — Cobranças demonstrativas

Aplicação acadêmica desenvolvida com **Node.js, Express e MySQL**. Permite criar cobranças demonstrativas, consultar e listar registros, filtrar por status e acompanhar atualizações recebidas por webhook.

> **Atenção:** este projeto é exclusivamente didático. Não realiza pagamentos reais e não gera um QR Code PIX pagável. O botão da interface envia uma notificação simulada para a própria API.

## 1. Requisitos

- Node.js 18 ou superior (recomendado: versão LTS)
- npm
- MySQL 8 ou compatível

## 2. Instalação

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

Crie seu arquivo de configuração copiando `.env.example` para `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

Edite o `.env` com os dados do seu MySQL. Altere também `WEBHOOK_TOKEN` para um valor conhecido apenas no seu ambiente local.

## 3. Banco de dados

No MySQL Workbench, DBeaver ou terminal MySQL, execute o conteúdo do arquivo `database.sql`. Ele cria o banco `webhook` e duas tabelas:

- `pagamentos`: guarda cliente, valor, status e datas;
- `eventos_webhook`: guarda os identificadores dos eventos já recebidos. `evento_id` é chave primária, impedindo que o mesmo evento seja gravado novamente.

Exemplo de configuração local:

```env
PORT=3000
WEBHOOK_TOKEN=troque-este-token-local
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=webhook
```

Não envie seu `.env` com senhas ou tokens para repositórios públicos. O arquivo `.env.example` pode ser compartilhado porque contém apenas valores ilustrativos.

## 4. Executar

Modo normal:

```bash
npm start
```

Modo desenvolvimento (reinicia ao salvar arquivos):

```bash
npm run dev
```

Acesse `http://localhost:3000` no navegador. O endpoint `GET /api/health` informa se a aplicação está online.

## 5. Rotas da API

Todas as respostas da API são JSON.

| Método | Rota | Finalidade |
|---|---|---|
| `POST` | `/pagamentos` | Criar cobrança |
| `GET` | `/pagamentos` | Listar todas as cobranças |
| `GET` | `/pagamentos?status=pending` | Filtrar por status |
| `GET` | `/pagamentos/:id` | Consultar cobrança pelo UUID |
| `POST` | `/webhook/pagamento` | Receber webhook autenticado |
| `POST` | `/webhook/simular` | Simular evento pela interface didática |
| `GET` | `/api/health` | Verificar disponibilidade da aplicação |

Status aceitos para consulta: `pending`, `approved`, `rejected` e `cancelled`. O webhook recebe atualizações finais: `approved`, `rejected` ou `cancelled`.

### Criar cobrança

```bash
curl -X POST http://localhost:3000/pagamentos \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Ana Silva","valor":59.90}'
```

Retorno esperado: HTTP `201 Created`, com o objeto `pagamento` e seu identificador `id`.

### Listar e filtrar

```bash
curl http://localhost:3000/pagamentos
curl "http://localhost:3000/pagamentos?status=approved"
```

### Consultar por identificador

Substitua `UUID_DA_COBRANCA` pelo campo `id` retornado na criação:

```bash
curl http://localhost:3000/pagamentos/UUID_DA_COBRANCA
```

### Enviar webhook

Use o mesmo `WEBHOOK_TOKEN` configurado no `.env`. O `eventoId` deve ser único por notificação:

```bash
curl -X POST http://localhost:3000/webhook/pagamento \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: troque-este-token-local" \
  -d '{"pagamentoId":"UUID_DA_COBRANCA","status":"approved","eventoId":"evento-0001"}'
```

Se a mesma notificação for enviada novamente com o mesmo `eventoId`, a API responde HTTP `200` com `duplicado: true` e não atualiza o pagamento outra vez.

### Simulação pela interface

Na seção de detalhes, escolha um status e clique em **Enviar notificação simulada**. Essa rota é destinada apenas ao botão demonstrativo da aplicação. Para integração externa, use `/webhook/pagamento`, que exige o token.

## 6. Códigos HTTP principais

| Código | Situação |
|---|---|
| `200` | Consulta ou webhook processado; evento duplicado também é reconhecido com `200` |
| `201` | Cobrança criada |
| `400` | JSON, campos, valor ou status inválido |
| `401` | Token do webhook ausente ou inválido |
| `404` | Pagamento não encontrado |
| `500` | Erro interno ou falha de acesso ao banco |

## 7. Persistência e prevenção de duplicidade

Os dados não dependem de `Map` ou `Set` em memória. As consultas são realizadas diretamente no MySQL. O processamento do webhook utiliza transação (`BEGIN`, `COMMIT` e `ROLLBACK`), bloqueia o pagamento durante a operação (`SELECT ... FOR UPDATE`) e registra o evento em `eventos_webhook`. A chave primária de `evento_id` é a proteção definitiva contra duplicidade, inclusive se duas notificações iguais chegarem quase ao mesmo tempo.

## 8. Testes automatizados

Execute:

```bash
npm test
```

Os testes usam o módulo nativo `node:test`, um servidor HTTP local e um armazenamento falso em memória para validar o comportamento das rotas sem exigir um MySQL ativo. Eles cobrem criação e consulta, listagem com filtro, atualização de status, evento duplicado, dados inválidos e token incorreto. A persistência real é implementada no `paymentStore` com MySQL.

## 9. Estrutura do projeto

```text
projeto-webhook/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── config/
│   │   └── database.js
│   ├── routes/
│   │   ├── paymentRoutes.js
│   │   └── webhookRoutes.js
│   ├── store/
│   │   └── paymentStore.js
│   └── app.js
├── test/
│   └── api.test.js
├── .env.example
├── database.sql
├── package.json
├── README.md
└── server.js
```

## 10. Observação sobre segurança

O token em cabeçalho é uma proteção didática simples. Em um serviço real, seria necessário usar HTTPS, gestão segura de segredos, autenticação/assinatura do provedor, logs, monitoramento e políticas de transição de status. A rota `/webhook/simular` não deve ser exposta sem proteção em um ambiente público.
