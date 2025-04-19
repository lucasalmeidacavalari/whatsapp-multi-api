import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();
import { authMiddleware } from "../middleware/authMiddleware.js";

router.get("/session-status/:cpfcnpj", authMiddleware, async (req, res) => {
  const { cpfcnpj } = req.params;

  try {
    const empresa = await prisma.tempresa.findUnique({
      where: { cpfcnpj },
      include: {
        sessions: {
          select: {
            sessionName: true,
            numero: true,
            isConnected: true,
            createdAt: true,
          },
        },
      },
    });

    if (!empresa) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    return res.json({
      empresa: empresa.nome,
      cpfcnpj: empresa.cpfcnpj,
      sessoes: empresa.sessions,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar sessões" });
  }
});

export default router;
