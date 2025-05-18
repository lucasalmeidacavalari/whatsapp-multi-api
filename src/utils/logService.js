import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function logSessao(sessionId, message) {
  try {
    await prisma.tsessionlog.create({
      data: {
        sessionId,
        message,
      },
    });
  } catch (err) {
    console.error(`Erro ao registrar log da sessão ${sessionId}:`, err.message);
  }
}
