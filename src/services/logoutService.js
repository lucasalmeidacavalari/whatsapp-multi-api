import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";

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
        try {
          const { connection, lastDisconnect } = update;

          if (connection === "open") {
            sock.logout();
            resolve();
          } else if (connection === "close" || lastDisconnect) {
            console.log(
              `Sessão ${sessionName} já desconectada, realizando logout.`
            );
            resolve();
          } else if (lastDisconnect?.error?.output?.statusCode === 401) {
            console.log(
              `Sessão ${sessionName} desconectada por falha de autenticação.`
            );
            sock.logout();
            resolve();
          }
        } catch (err) {
          console.error("Erro ao atualizar conexão durante logout:", err);
          resolve();
        }
      });
    });

    try {
      const existingSession = await prisma.tsession.findFirst({
        where: { sessionName },
      });
      if (existingSession) {
        await prisma.tsession.delete({ where: { id: existingSession.id } });
        console.log(`Sessão ${sessionName} removida do banco.`);
      } else {
        console.log(`Sessão ${sessionName} já foi removida do banco.`);
      }
    } catch (err) {
      console.error("Erro ao remover sessão do banco:", err);
    }

    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
      console.log(`Pasta da sessão ${sessionName} removida!`);
    } catch (err) {
      console.error("Erro ao remover arquivos da sessão:", err);
    }

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
