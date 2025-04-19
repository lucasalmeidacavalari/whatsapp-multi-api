import express from "express";
import dotenv from "dotenv";

// Rotas
import connectRoutes from "./routes/connectRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import logoutRoutes from "./routes/logoutRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";

// Configuração
dotenv.config();
const app = express();
app.use(express.json());

// Middleware de rotas
app.use("/api", connectRoutes);
app.use("/api", sessionRoutes);
app.use("/api", messageRoutes);
app.use("/api", logoutRoutes);
app.use("/api", mediaRoutes);
app.use("/api", groupRoutes);

// Rota base
app.get("/", (req, res) => {
  res.send("API WhatsApp Multi-Sessão SGBR funcionando!");
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
