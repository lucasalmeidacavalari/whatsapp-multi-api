import { getOrCreateSession } from "../utils/sessionManager.js";
import { PrismaClient } from "@prisma/client";
import { logSessao } from "../utils/logService.js";

const prisma = new PrismaClient();
const INTERVAL_MINUTES = 3;
const MAX_TENTATIVAS = 3;

const contadorTentativas = new Map();

async function verificarSessoesInativas() {
  try {
    const sessoes = await prisma.tsession.findMany();

    for (const sessao of sessoes) {
      const sessionName = sessao.sessionName;
      const status = sessao.status;

      if (status === "ATIVA") {
        contadorTentativas.delete(sessionName); // 🔄 reset se voltou a funcionar
        continue;
      }

      if (status !== "INATIVA" && status !== "ERRO") {
        continue; // ignora sessões que não precisam de reativação
      }

      const tentativas = contadorTentativas.get(sessionName) || 0;
      if (tentativas >= MAX_TENTATIVAS) {
        await logSessao(sessao.id, `⛔ Sessão ignorada (limite de ${MAX_TENTATIVAS} tentativas atingido)`);
        continue;
      }

      try {
        await logSessao(sessao.id, `⏳ Tentando reativar sessão... (tentativa ${tentativas + 1})`);

        const sock = await getOrCreateSession(sessionName, sessao.sessionPath);

        if (sock) {
          await logSessao(sessao.id, "✅ Sessão reativada com sucesso");
          contadorTentativas.delete(sessionName); // sucesso → zera
        } else {
          await logSessao(sessao.id, "❌ Falha ao reativar sessão (sock null)");
          contadorTentativas.set(sessionName, tentativas + 1);
        }
      } catch (err) {
        await logSessao(sessao.id, `❌ Erro na reativação: ${err.message}`);
        contadorTentativas.set(sessionName, tentativas + 1);
      }
    }
  } catch (err) {
    console.error("❌ Erro no watchdog de sessões:", err);
  }
}

// ⏱ Executa a cada X minutos
setInterval(verificarSessoesInativas, INTERVAL_MINUTES * 60 * 1000);

// 🟢 Executa imediatamente ao iniciar
verificarSessoesInativas();
