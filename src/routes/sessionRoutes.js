import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { sanitizeCpfCnpj, isValidCpfCnpj } from "../utils/validateCpfCnpj.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/session-status/:cpfcnpj", authMiddleware, async (req, res) => {
  const raw = req.params.cpfcnpj;
  const clean = sanitizeCpfCnpj(raw);

  if (!isValidCpfCnpj(clean)) {
    return res.status(400).json({ error: "CPF/CNPJ inválido" });
  }

  const { numero } = req.query;

  try {
    const empresa = await prisma.tempresa.findUnique({
      where: { cpfcnpj: clean },
      include: {
        sessions: {
          where: numero
            ? {
                numero: {
                  contains: numero.toString().replace(/\D/g, ""), // limpa e faz busca por trecho
                },
              }
            : undefined,
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
