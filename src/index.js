import express from "express";
import dotenv from "dotenv";
import connectRoutes from "./routes/connectRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import messageRoutes from './routes/messageRoutes.js';
import logoutRoutes from './routes/logoutRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';

dotenv.config();
const app = express();
app.use(express.json());

app.use("/api", connectRoutes);
app.use("/api", sessionRoutes);
app.use('/api', messageRoutes);
app.use('/api', logoutRoutes);
app.use('/api', mediaRoutes);

app.get("/", (req, res) => {
  res.send("API WhatsApp Multi-Sessão funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
