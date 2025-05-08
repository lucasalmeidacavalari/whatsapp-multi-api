import express from "express";
import { sendTextMessageHandler } from "../services/messageService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/send-text", authMiddleware, async (req, res) => {
  const { sessionName, to, message } = req.body;

  if (!sessionName || !to || !message) {
    return res
      .status(400)
      .json({ error: "sessionName, to e message são obrigatórios" });
  }

  try {
    const result = await sendTextMessageHandler({ sessionName, to, message });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    return res.status(500).json({ error: "Erro interno ao enviar mensagem" });
  }
});

export default router;
