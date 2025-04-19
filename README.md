# WhatsApp Multi-Sessão API

Uma API Node.js para envio de mensagens e mídias via WhatsApp com suporte a múltiplas sessões (multi-número), utilizando Baileys, Express, Prisma e PostgreSQL.

## 🚀 Tecnologias

- Node.js + Express
- Baileys (WhatsApp Web API)
- PostgreSQL + Prisma ORM
- Docker + Nodemon
- JWT Auth (Bearer Token)

## ⚙️ Funcionalidades

- Conectar e autenticar múltiplos números de WhatsApp
- Enviar mensagens de texto ou mídia (PDF, imagem, áudio, etc)
- Suporte a grupos e números internacionais
- Sessões persistentes com reconexão automática
- Validações de CPF/CNPJ e número de WhatsApp
- Token de autenticação via `.env`

## 📁 Estrutura

```
src/
├── middleware/           # Auth Middleware
├── routes/               # Rotas Express
├── services/             # Lógica de envio e conexão
├── utils/                # Validações e helpers
├── prisma/               # Esquema e migrações
└── index.js              # Inicialização do servidor
```

## 🔐 Autenticação

Todas as rotas protegidas requerem `Bearer Token` no header da requisição.

```http
Authorization: Bearer SEU_TOKEN_AQUI
```

## 📦 Rotas principais

### Conectar um novo número (gera QR code)

`POST /api/connect`

```json
{
  "cpfcnpj": "49449213810",
  "nome": "Empresa Exemplo"
}
```

### Verificar sessões ativas por CNPJ

`GET /api/session-status/:cpfcnpj`

### Enviar mensagem de texto

`POST /api/send-text`

```json
{
  "sessionName": "uuid-da-sessao",
  "to": ["+5511888887777", "+5511999998888", "5511988887777"],
  "message": "Olá!"
}
```

### Enviar mídia (via multipart/form-data)

`POST /api/send-media`

```form-data
- sessionName: uuid-da-sessao
- to: +5511888887777
- caption: Arquivo importante
- file: arquivo.pdf (upload)
```

### Listar grupos da sessão

`GET /api/list-groups/:sessionName`

## 🧪 Testes com Postman

- Use o Bearer token no campo de Authorization
- Configure as requisições conforme os exemplos acima

## 🛠️ Variáveis de Ambiente (.env)

```env
PORT=3003
JWT_SECRET=sua_chave_secreta
DATABASE_URL=postgresql://usuario:senha@host:porta/db
```

## 🐳 Docker

```bash
docker-compose up --build
```

## 🧠 Créditos

Desenvolvido por Lucas Cavalari com ♥ usando Baileys e Node.js.
