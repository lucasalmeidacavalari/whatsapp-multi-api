# WhatsApp Multi-Sessão API

API RESTful para envio de mensagens e mídias via WhatsApp com suporte a múltiplas sessões utilizando Baileys, Node.js, Express, Prisma e Docker.

## Recursos

- Multi-sessão com reconexão automática
- Suporte a CPF/CNPJ como identificador da empresa
- Envio de texto, imagem, vídeo, áudio e documentos
- Validação automática de número (suporte internacional)
- Consulta de grupos por sessão
- Sessões persistidas em disco e banco de dados PostgreSQL
- Autenticação via Bearer Token
- Pronto para deploy via Docker

## Endpoints

### Sessão

- `POST /connect`: Cria nova sessão para o CPF/CNPJ informado
- `GET /session-status/:cpfcnpj`: Retorna as sessões ativas/inativas da empresa

### Mensagens

- `POST /send-text`: Envia texto para um ou vários contatos ou grupos
- `POST /send-media`: Envia mídias para contatos ou grupos (aceita multipart/form-data)

### Grupos

- `GET /groups/:sessionName`: Lista os grupos visíveis para a sessão

## Autenticação

Todos os endpoints exigem Bearer Token (exemplo: `Authorization: Bearer seu_token_aqui`).

## Variáveis de ambiente

Crie um arquivo `.env` com o seguinte conteúdo:

```
DATABASE_URL=postgresql://postgres:postgres@db:5432/whatsappdb
JWT_SECRET=sua_chave_jwt_aqui
PORT=3003
```

## Uso com Docker

```bash
docker-compose up -d --build
```

## Estrutura

```
├── prisma/
│   └── schema.prisma
├── src/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── index.js
├── sessions/  # onde ficam as sessões
├── .env
├── Dockerfile
├── docker-compose.yml
```

## Observações

- Os arquivos de mídia enviados não são armazenados no servidor
- O número do WhatsApp é normalizado automaticamente, incluindo tentativas com o "9" em números brasileiros

---

Desenvolvido por [Seu Time]
