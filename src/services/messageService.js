import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";
import { getOrCreateSession } from "../utils/sessionManager.js";
import { normalizeNumber, isFixoBR } from "../utils/normalizeNumber.js";
import { withTimeout } from "../utils/withTimeout.js";

const prisma = new PrismaClient();

export async function sendTextMessageHandler({
  sessionName,
  to,
  message: messageText,
}) {
  try {
    const session = await prisma.tsession.findFirst({ where: { sessionName } });
    if (!session || !session.isConnected) {
      return {
        success: false,
        error: "Sessão não encontrada ou desconectada",
      };
    }

    const sessionDir = session.sessionPath;
    await fs.access(sessionDir);

    const sock = await getOrCreateSession(sessionName, sessionDir);
    await new Promise((res) => setTimeout(res, 2000));

    const numbers = Array.isArray(to) ? to : [to];
    const results = [];

    for (const num of numbers) {
      let jid = num;

      if (!num.endsWith("@g.us")) {
        const normalized = normalizeNumber(num);
        if (!normalized) {
          results.push({
            to: num,
            status: "número inválido (não reconhecido)",
          });
          continue;
        }

        let result;
        try {
          [result] = await withTimeout(sock.onWhatsApp(normalized), 10000);
        } catch (error) {
          console.error("Erro ao consultar número (normalizado):", error);
          results.push({
            to: num,
            status: "timeout ou erro ao consultar número",
          });
          continue;
        }

        if (!result || !result.exists) {
          const withNine = normalized.replace(/^(55\d{2})(\d{8})$/, "$19$2");
          try {
            [result] = await withTimeout(sock.onWhatsApp(withNine), 10000);
          } catch (error) {
            console.error("Erro ao consultar número (com 9):", error);
            results.push({
              to: num,
              status: "timeout ou erro ao consultar número (com 9)",
            });
            continue;
          }
        }

        if (!result || !result.exists) {
          const fixoCorrigido = isFixoBR(normalized);
          if (fixoCorrigido) {
            console.warn(
              `Número fixo detectado (${fixoCorrigido}), forçando envio`
            );
            jid = fixoCorrigido + "@s.whatsapp.net";
          } else {
            results.push({
              to: num,
              status: "número não encontrado no WhatsApp",
            });
            continue;
          }
        } else {
          jid = result.jid;
        }
      }

      console.log(`→ Enviando para: ${jid}`);
      try {
        await sock.sendMessage(jid, { text: messageText });
        results.push({ to: jid, status: "enviado" });
      } catch (error) {
        if (
          error?.output?.statusCode === 408 ||
          error?.message?.includes("Timed Out")
        ) {
          console.error("Timeout ao enviar mensagem:", error);
          results.push({ to: jid, status: "erro: timeout ao enviar mensagem" });
        } else {
          console.error("Erro inesperado ao enviar mensagem:", error);
          results.push({
            to: jid,
            status: "erro inesperado ao enviar mensagem",
          });
        }
      }
    }

    return { success: true, results };
  } catch (err) {
    console.error("Erro geral na função sendTextMessageHandler:", err);
    return { success: false, error: err.message };
  }
}
