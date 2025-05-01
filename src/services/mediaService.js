import mime from "mime-types";
import { PrismaClient } from "@prisma/client";
import { getOrCreateSession } from "../utils/sessionManager.js";
import { normalizeNumber } from "../utils/normalizeNumber.js";
import { withTimeout } from "../utils/withTimeout.js";

const prisma = new PrismaClient();

export async function sendMediaHandler(req, res) {
  const { sessionName, to, buffer, originalName, caption } = req.body;

  try {
    const session = await prisma.tsession.findFirst({ where: { sessionName } });
    if (!session || !session.isConnected)
      return res.status(200).json({
        success: false,
        error: "Sessão não encontrada ou desconectada",
      });

    const sessionDir = session.sessionPath;
    const sock = await getOrCreateSession(sessionName, sessionDir, res);
    await new Promise((res) => setTimeout(res, 2000));

    const mimeType = mime.lookup(originalName) || "application/octet-stream";
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
          results.push({
            to: num,
            status: "número não encontrado no WhatsApp",
          });
          continue;
        }

        jid = result.jid;
      }

      console.log(`→ Enviando mídia para: ${jid}`);

      let message;
      if (mimeType.startsWith("image/")) {
        message = { image: buffer, caption };
      } else if (mimeType.startsWith("video/")) {
        message = { video: buffer, caption };
      } else if (mimeType.startsWith("audio/")) {
        message = { audio: buffer, mimetype: mimeType, ptt: false };
      } else {
        message = {
          document: buffer,
          mimetype: mimeType,
          fileName: originalName,
          caption,
        };
      }

      try {
        await sock.sendMessage(jid, message);
        results.push({ to: jid, status: "mídia enviada com sucesso" });
      } catch (error) {
        if (
          error?.output?.statusCode === 408 ||
          error?.message?.includes("Timed Out")
        ) {
          console.error("Timeout ao enviar mídia:", error);
          results.push({ to: jid, status: "erro: timeout ao enviar mídia" });
        } else {
          console.error("Erro inesperado ao enviar mídia:", error);
          results.push({ to: jid, status: "erro inesperado ao enviar mídia" });
        }
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("Erro geral na função sendMediaHandler:", err);
    return res.status(200).json({ success: false, error: err.message });
  }
}
