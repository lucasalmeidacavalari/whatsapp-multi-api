import express from "express";
import dotenv from "dotenv";
import sessionRoutes from "./routes/sessionRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api", sessionRoutes);

app.get("/", (req, res) => {
  res.send("API WhatsApp Multi-Sessão funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
