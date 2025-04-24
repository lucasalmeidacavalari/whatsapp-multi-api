import fs from "fs/promises";
import path from "path";
import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import { PrismaClient } from "@prisma/client";

const sessions = new Map();
const prisma = new PrismaClient();

export async function getOrCreateSession(sessionName, sessionPath, res = null) {
  const existing = sessions.get(sessionName);

  if (existing) {
    existing.lastUsed = Date.now();
    return existing.sock;
  }

  const absoluteSessionPath = path.isAbsolute(sessionPath)
    ? sessionPath
    : path.resolve(process.cwd(), sessionPath); // Garante que o caminho seja absoluto

  const { state, saveCreds } = await useMultiFileAuthState(absoluteSessionPath);
  const sock = makeWASocket({ auth: state });

  // Passando o sessionName para o sock diretamente
  sock.sessionName = sessionName;

  // Monitorando a atualização da conexão
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    const sessionId = sock.sessionName; // Usando sessionName diretamente de sock

    // Quando a conexão for fechada
    if (connection === "close") {
      console.log(`Sessão ${sessionId} desconectada!`);

      // Verifica se a desconexão foi devido à desconexão do celular
      if (lastDisconnect?.error?.output?.statusCode === 401) {
        console.log(
          `Sessão ${sessionId} desconectada devido à falha de autenticação (provavelmente celular desconectado)!`
        );

        // Precisamos obter o `empresaId` para excluir a sessão
        const session = await prisma.tsession.findFirst({
          where: { sessionName: sessionId },
          select: { empresaId: true, sessionPath: true }, // Pegamos o `empresaId` e `sessionPath` associados à sessão
        });

        if (session) {
          // Agora podemos deletar a sessão usando `empresaId` e `sessionName`
          await prisma.tsession.delete({
            where: {
              empresaId_sessionName: {
                empresaId: session.empresaId,
                sessionName: sessionId,
              },
            },
          });

          // Remover a pasta da sessão local
          await fs.rm(session.sessionPath, { recursive: true, force: true });
          console.log(`Pasta da sessão ${sessionId} removida!`);

          // Remover do cache também
          sessions.delete(sessionId);

          // Enviar resposta de sucesso para o Postman, se res estiver disponível
          if (res) {
            return res
              .status(200)
              .json({
                message: `Sessão ${sessionId} desconectada devido à falha de autenticação (provavelmente celular desconectado)!`,
              });
          } else {
            console.log("Sessão desconectada e apagada com sucesso");
          }
        } else {
          console.log("Sessão não encontrada");

          // Enviar erro se res estiver disponível
          if (res) {
            return res.status(404).json({ error: "Sessão não encontrada" });
          }
        }
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Aguarda até que a conexão seja aberta
  await waitForConnectionOpen(sock);

  // Armazena a sessão no cache local
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
  const TIMEOUT = 1 * 60 * 1000; // 1 minuto

  for (const [sessionName, { sock, lastUsed }] of sessions.entries()) {
    if (now - lastUsed > TIMEOUT) {
      console.log(`🧹 Encerrando sessão inativa: ${sessionName}`);
      sock.end(); // desconecta
      sessions.delete(sessionName);
    }
  }
}, 60 * 1000);
