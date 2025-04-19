import mime from "mime-types";
import { PrismaClient } from "@prisma/client";
import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import { waitForConnectionOpen } from "../utils/sessionManager.js";

const prisma = new PrismaClient();

export async function sendMedia({
  sessionName,
  to,
  buffer,
  originalName,
  caption,
}) {
  const session = await prisma.tsession.findFirst({ where: { sessionName } });

  if (!session || !session.isConnected) {
    throw new Error("Sessão não encontrada ou desconectada");
  }

  const sessionDir = session.sessionPath;
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);

  await waitForConnectionOpen(sock);
  await new Promise((res) => setTimeout(res, 2000)); // Aguarda sync com WA

  const mimeType = mime.lookup(originalName) || "application/octet-stream";
  const numbers = Array.isArray(to) ? to : [to];
  const results = [];

  for (const num of numbers) {
    let jid = num;

    if (!num.endsWith("@g.us")) {
      const number = num.replace(/\D/g, "");
      let [result] = await sock.onWhatsApp(number);

      if (
        !result ||
        !result.exists ||
        result.jid !== `${number}@s.whatsapp.net`
      ) {
        const withNine = number.replace(/^(55\d{2})(\d{8})$/, "$19$2");
        [result] = await sock.onWhatsApp(withNine);
      }

      if (!result || !result.exists) {
        results.push({ to: num, status: "número inválido" });
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

    await sock.sendMessage(jid, message);
    results.push({ to: jid, status: "mídia enviada com sucesso" });
  }

  return { success: true, results };
}
