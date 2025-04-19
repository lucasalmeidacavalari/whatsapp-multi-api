import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";
import { waitForConnectionOpen } from "../utils/sessionManager.js";

const prisma = new PrismaClient();

export async function sendTextMessage({ sessionName, to, message }) {
  const session = await prisma.tsession.findFirst({ where: { sessionName } });

  if (!session || !session.isConnected) {
    throw new Error("Sessão não encontrada ou desconectada");
  }

  const sessionDir = session.sessionPath;
  await fs.access(sessionDir); // Garante que pasta existe

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);

  await waitForConnectionOpen(sock);
  await new Promise((res) => setTimeout(res, 2000)); // Aguarda sync com WA

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

    console.log(`→ Enviando para: ${jid}`);
    await sock.sendMessage(jid, { text: message });
    results.push({ to: jid, status: "enviado" });
  }

  return { success: true, results };
}
