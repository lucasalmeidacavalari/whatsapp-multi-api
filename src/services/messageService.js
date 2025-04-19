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

  try {
    await fs.access(sessionDir);
  } catch {
    throw new Error("Diretório da sessão não encontrado");
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);

  await waitForConnectionOpen(sock);

  // Garante que `to` é um array
  const numbers = Array.isArray(to) ? to : [to];

  const results = [];

  for (const num of numbers) {
    const number = num.replace(/\D/g, "");
    let [result] = await sock.onWhatsApp(number);

    // Tenta com 9 se necessário
    if (
      !result ||
      !result.exists ||
      result.jid !== `${number}@s.whatsapp.net`
    ) {
      const withNine = number.replace(/^(55\d{2})(\d{8})$/, "$19$2");
      [result] = await sock.onWhatsApp(withNine);
    }

    if (result && result.exists) {
      await sock.sendMessage(result.jid, { text: message });
      results.push({ to: result.jid, status: "enviado" });
    } else {
      results.push({ to: num, status: "número inválido" });
    }
  }

  return {
    success: true,
    results,
  };
}
