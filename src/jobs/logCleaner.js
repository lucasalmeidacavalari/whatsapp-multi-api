import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;
const TRES_DIAS_EM_MS = 3 * 24 * 60 * 60 * 1000;

async function limparLogsAntigos() {
  const limiteData = new Date(Date.now() - TRES_DIAS_EM_MS);

  try {
    const deletados = await prisma.tsessionlog.deleteMany({
      where: {
        createdAt: {
          lt: limiteData,
        },
      },
    });

    console.log(
      `🧹 ${new Date().toISOString()} - Limpeza de logs: ${
        deletados.count
      } registros removidos com mais de 3 dias.`
    );
  } catch (err) {
    console.error("❌ Erro ao limpar logs antigos:", err.message);
  }
}

// Roda imediatamente ao iniciar
limparLogsAntigos();

// Agendamento para rodar a cada 24 horas
setInterval(limparLogsAntigos, UM_DIA_EM_MS);
