import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";
import { getOrCreateSession } from "../utils/sessionManager.js";
import { normalizeNumber } from "../utils/normalizeNumber.js";

const prisma = new PrismaClient();

export async function sendTextMessage({ sessionName, to, message }) {
  const session = await prisma.tsession.findFirst({ where: { sessionName } });
  if (!session || !session.isConnected)
    throw new Error("Sessão não encontrada ou desconectada");

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
        results.push({ to: num, status: "número inválido (não reconhecido)" });
        continue;
      }

      let [result] = await sock.onWhatsApp(normalized);

      if (!result || !result.exists) {
        const withNine = normalized.replace(/^(55\d{2})(\d{8})$/, "$19$2");
        [result] = await sock.onWhatsApp(withNine);
      }

      if (!result || !result.exists) {
        results.push({ to: num, status: "número não encontrado no WhatsApp" });
        continue;
      }

      jid = result.jid;
    }

    console.log(`→ Enviando para: ${jid}`);
    await sock.sendMessage(jid, { text: message });
    results.push({ to: jid, status: "enviado" });
  }

  return { success: true, results };
}
