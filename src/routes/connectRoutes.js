import express from "express";
import { connectSession } from "../services/whatsappService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { sanitizeCpfCnpj, isValidCpfCnpj } from "../utils/validateCpfCnpj.js";

const router = express.Router();

router.post("/connect", authMiddleware, async (req, res) => {
  const { cpfcnpj, nome } = req.body;

  if (!cpfcnpj || !nome) {
    return res.status(400).json({ error: "cpfcnpj e nome são obrigatórios" });
  }

  const clean = sanitizeCpfCnpj(cpfcnpj);
  if (!isValidCpfCnpj(clean)) {
    return res.status(400).json({ error: "CPF/CNPJ inválido" });
  }

  try {
    const result = await connectSession({ cpfcnpj: clean, nome });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao conectar sessão" });
  }
});

export default router;
