import express from "express";
import { connectSession } from "../services/whatsappService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/connect", authMiddleware, async (req, res) => {
  const { cpfcnpj, nome } = req.body;

  if (!cpfcnpj || !nome) {
    return res.status(400).json({ error: "cpfcnpj e nome são obrigatórios" });
  }

  try {
    const result = await connectSession({ cpfcnpj, nome });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao conectar sessão" });
  }
});

export default router;
