import fs from "fs/promises";
import path from "path";
import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import { PrismaClient } from "@prisma/client";

export const sessions = new Map();
const prisma = new PrismaClient();

export async function getOrCreateSession(sessionName, sessionPath) {
  const existing = sessions.get(sessionName);

  if (existing) {
    existing.lastUsed = Date.now();
    return existing.sock;
  }

  const absoluteSessionPath = path.isAbsolute(sessionPath)
    ? sessionPath
    : path.resolve(process.cwd(), sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(absoluteSessionPath);
  const sock = makeWASocket({ auth: state });

  sock.sessionName = sessionName;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    const sessionId = sock.sessionName;

    if (connection === "close") {
      console.log(`Sessão ${sessionId} desconectada!`);

      if (lastDisconnect?.error?.output?.statusCode === 401) {
        console.log(`Desconexão por falha de autenticação.`);

        const session = await prisma.tsession.findFirst({
          where: { sessionName: sessionId },
          select: { empresaId: true, sessionPath: true },
        });

        if (session) {
          await prisma.tsession.delete({
            where: {
              empresaId_sessionName: {
                empresaId: session.empresaId,
                sessionName: sessionId,
              },
            },
          });

          await fs.rm(session.sessionPath, { recursive: true, force: true });
          sessions.delete(sessionId);
          console.log(`Sessão ${sessionId} removida com sucesso.`);
        } else {
          console.log(`Sessão ${sessionId} não encontrada no banco.`);
        }
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  try {
    await waitForConnectionOpen(sock);
  } catch (err) {
    console.error(
      `Erro ao abrir conexão para a sessão ${sessionName}:`,
      err.message
    );

    try {
      const session = await prisma.tsession.findFirst({
        where: { sessionName },
        select: { empresaId: true, sessionPath: true },
      });

      if (session) {
        await prisma.tsession.delete({
          where: {
            empresaId_sessionName: {
              empresaId: session.empresaId,
              sessionName: sessionName,
            },
          },
        });

        await fs.rm(session.sessionPath, { recursive: true, force: true });
        console.log(
          `Sessão ${sessionName} inválida removida do banco e sistema.`
        );
      }
    } catch (e) {
      console.warn("Erro ao limpar sessão inválida do banco:", e.message);
    }

    sessions.delete(sessionName);
    return null;
  }

  sessions.set(sessionName, { sock, lastUsed: Date.now() });

  return sock;
}

export function waitForConnectionOpen(sock, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sock.ev.off("connection.update", listener);
      reject(new Error("Tempo de espera excedido para abrir a conexão"));
    }, timeoutMs);

    const listener = (update) => {
      if (update.connection === "open") {
        clearTimeout(timeout);
        sock.ev.off("connection.update", listener);
        resolve();
      } else if (update.connection === "close") {
        clearTimeout(timeout);
        sock.ev.off("connection.update", listener);
        reject(new Error("Conexão fechada ao tentar abrir sessão"));
      }
    };

    sock.ev.on("connection.update", listener);
  });
}

// 🧹 Cleanup automático a cada 1 minuto
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 1 * 60 * 1000; // 1 minuto

  for (const [sessionName, { sock, lastUsed }] of sessions.entries()) {
    if (now - lastUsed > TIMEOUT) {
      console.log(`🧹 Encerrando sessão inativa: ${sessionName}`);
      sock.end();
      sessions.delete(sessionName);
    }
  }
}, 60 * 1000);
