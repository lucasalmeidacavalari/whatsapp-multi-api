FROM node:20

# Cria diretório de trabalho
WORKDIR /app

# Copia os arquivos
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src
COPY .env ./
COPY sessions ./sessions

# Instala dependências
RUN npm install

# Gera cliente do Prisma
RUN npx prisma generate

# Porta da API
EXPOSE 3003


CMD ["npm", "run", "dev"]
