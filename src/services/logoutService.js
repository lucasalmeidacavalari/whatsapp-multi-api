import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";
import { logSessao } from "../utils/logService.js";

const prisma = new PrismaClient();
const sessionsPath = path.resolve("sessions");

export async function logoutSession(sessionName) {
  try {
    const session = await prisma.tsession.findFirst({ where: { sessionName } });

    if (!session) {
      console.warn("Sessão não encontrada:", sessionName);
      return { success: false, message: "Sessão não encontrada" };
    }

    const sessionDir = session.sessionPath;

    try {
      await fs.access(sessionDir);
    } catch {
      console.warn("Diretório da sessão não encontrado:", sessionDir);
      return { success: false, message: "Diretório da sessão não encontrado" };
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({ auth: state });
    sock.ev.on("creds.update", saveCreds);

    await new Promise((resolve) => {
      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          sock.logout();
          resolve();
        } else if (connection === "close" || lastDisconnect) {
          resolve();
        } else if (lastDisconnect?.error?.output?.statusCode === 401) {
          sock.logout();
          resolve();
        }
      });
    });

    // Atualiza o status da sessão no banco
    await prisma.tsession.updateMany({
      where: { sessionName },
      data: {
        isConnected: false,
        status: "EXPIRADA",
        ultimoUso: new Date(),
      },
    });

    // Registra log de logout
    await logSessao(session.id, "🔒 Sessão encerrada manualmente via logout.");

    return { success: true, sessionName };
  } catch (error) {
    console.error("Erro geral no logoutSession:", error);
    return {
      success: false,
      message: "Erro no logout da sessão",
      detalhe: error?.message,
    };
  }
}
