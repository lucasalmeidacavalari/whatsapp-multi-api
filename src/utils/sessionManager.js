import fs from "fs/promises";
import path from "path";
import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import { PrismaClient, SessaoStatus } from "@prisma/client";
import { Boom } from "@hapi/boom";

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

    if (connection === "open") {
      console.log(`✅ Sessão ${sessionId} conectada`);
      await prisma.tsession.updateMany({
        where: { sessionName: sessionId },
        data: {
          status: "ATIVA",
          isConnected: true,
          ultimoUso: new Date(),
        },
      });
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log(`⚠️ Sessão ${sessionId} desconectada! Código: ${reason}`);

      let status = SessaoStatus.ERRO;
      if (reason === 401) status = "EXPIRADA";
      else if (reason === 408) status = "INATIVA";

      await prisma.tsession.updateMany({
        where: { sessionName: sessionId },
        data: {
          status,
          isConnected: false,
          ultimoUso: new Date(),
        },
      });

      sessions.delete(sessionId);

      if (reason === 515 || reason === 408) {
        console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
        setTimeout(() => {
          getOrCreateSession(sessionId, sessionPath);
        }, 10000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  try {
    await waitForConnectionOpen(sock);
  } catch (err) {
    console.error(
      `❌ Erro ao abrir conexão para a sessão ${sessionName}:`,
      err.message
    );

    await prisma.tsession.updateMany({
      where: { sessionName },
      data: {
        status: "ERRO",
        isConnected: false,
        ultimoUso: new Date(),
      },
    });

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

// 🧹 Cleanup automático a cada 10 minuto
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 10 * 60 * 1000; // 10 minutos

  for (const [sessionName, { sock, lastUsed }] of sessions.entries()) {
    if (now - lastUsed > TIMEOUT) {
      console.log(`🧹 Encerrando sessão inativa: ${sessionName}`);
      sock.end();
      sessions.delete(sessionName);

      prisma.tsession
        .updateMany({
          where: { sessionName },
          data: {
            isConnected: false,
            status: "INATIVA",
            ultimoUso: new Date(),
          },
        })
        .catch(console.error);
    }
  }
}, 60 * 1000);
