import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionsPath = path.resolve("sessions");

export async function sendTextMessage({ sessionName, to, message }) {
  // 1. Busca sessão no banco
  const session = await prisma.tsession.findFirst({
    where: { sessionName },
  });

  if (!session || !session.isConnected) {
    throw new Error("Sessão não encontrada ou desconectada");
  }

  const sessionDir = session.sessionPath;

  try {
    await fs.access(sessionDir); // verifica se a pasta existe
  } catch {
    throw new Error("Diretório da sessão não encontrado");
  }

  // 2. Restaura sessão via Baileys
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);

  // 3. Aguarda o socket estabilizar
  await waitForConnectionOpen(sock);

  // 4. Limpa o número e valida no WhatsApp
  const number = to.replace(/\D/g, "");
  let [result] = await sock.onWhatsApp(number);

  // Tenta com "9" se não encontrou
  let numberWithNine = null;
  if (!result || !result.exists || result.jid !== `${number}@s.whatsapp.net`) {
    numberWithNine = number.replace(/^(55\d{2})(\d{8})$/, "$19$2");
    [result] = await sock.onWhatsApp(numberWithNine);
  }

  if (!result || !result.exists) {
    throw new Error("Número não encontrado no WhatsApp");
  }

  // 5. Envia mensagem
  await sock.sendMessage(result.jid, { text: message });

  return {
    success: true,
    to: result.jid,
    message,
  };
}

function waitForConnectionOpen(sock) {
  return new Promise((resolve) => {
    const listener = (update) => {
      if (update.connection === "open") {
        sock.ev.off("connection.update", listener);
        resolve();
      }
    };
    sock.ev.on("connection.update", listener);
  });
}
