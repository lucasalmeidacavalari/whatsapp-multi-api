import { getOrCreateSession } from "../utils/sessionManager.js";
import { PrismaClient } from "@prisma/client";
import { logSessao } from "../utils/logService.js";

const prisma = new PrismaClient();
const INTERVAL_MINUTES = 3;

async function verificarSessoesInativas() {
  try {
    const inativas = await prisma.tsession.findMany({
      where: {
        status: { in: ["INATIVA", "ERRO"] },
        isConnected: false,
      },
    });

    for (const sessao of inativas) {
      try {
        await logSessao(sessao.id, "⏳ Tentando reativar sessão...");

        const sock = await getOrCreateSession(
          sessao.sessionName,
          sessao.sessionPath
        );

        if (sock) {
          await logSessao(sessao.id, "✅ Sessão reativada com sucesso");
        } else {
          await logSessao(sessao.id, "❌ Falha ao reativar sessão (sock null)");
        }
      } catch (err) {
        await logSessao(sessao.id, `❌ Erro na reativação: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("❌ Erro no watchdog de sessões:", err);
  }
}

// ⏱ Roda a cada X minutos
setInterval(verificarSessoesInativas, INTERVAL_MINUTES * 60 * 1000);

// 🟢 Executa imediatamente ao iniciar
verificarSessoesInativas();
