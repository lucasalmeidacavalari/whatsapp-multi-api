import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import path from "path";

const sessions = new Map();

export async function getOrCreateSession(sessionName, sessionPath) {
  const existing = sessions.get(sessionName);

  if (existing) {
    existing.lastUsed = Date.now();
    return existing.sock;
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);

  await waitForConnectionOpen(sock);

  sessions.set(sessionName, { sock, lastUsed: Date.now() });

  return sock;
}

export function waitForConnectionOpen(sock) {
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

// 🧹 Cleanup automático a cada 1 minuto
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 1 * 60 * 1000; // 1 minutos

  for (const [sessionName, { sock, lastUsed }] of sessions.entries()) {
    if (now - lastUsed > TIMEOUT) {
      console.log(`🧹 Encerrando sessão inativa: ${sessionName}`);
      sock.end(); // desconecta
      sessions.delete(sessionName);
    }
  }
}, 60 * 1000);
