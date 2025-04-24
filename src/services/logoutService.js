import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionsPath = path.resolve("sessions");

export async function logoutSession(sessionName) {
  const session = await prisma.tsession.findFirst({ where: { sessionName } });

  if (!session) {
    throw new Error("Sessão não encontrada");
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

  // Aguarda a conexão abrir antes de deslogar ou se já tiver sido desconectada, termina a execução
  await new Promise((resolve, reject) => {
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        sock.logout();
        resolve();
      } else if (connection === "close" || lastDisconnect) {
        // Se a conexão foi fechada ou desconectada, podemos realizar o logout diretamente
        console.log(
          `Sessão ${sessionName} já desconectada, realizando logout.`
        );
        resolve();
      } else if (lastDisconnect?.error?.output?.statusCode === 401) {
        // Caso tenha sido desconectado por erro de autenticação, podemos deslogar também
        console.log(
          `Sessão ${sessionName} desconectada por falha de autenticação.`
        );
        sock.logout();
        resolve();
      }
    });
  });

  // Verifica se a sessão ainda existe antes de tentar removê-la do banco
  const existingSession = await prisma.tsession.findFirst({
    where: { sessionName },
  });

  if (existingSession) {
    // Remove do banco
    await prisma.tsession.delete({ where: { id: existingSession.id } });
    console.log(`Sessão ${sessionName} removida do banco.`);
  } else {
    console.log(`Sessão ${sessionName} já foi removida do banco.`);
  }

  // Remove arquivos da sessão (opcional)
  await fs.rm(sessionDir, { recursive: true, force: true });
  console.log(`Pasta da sessão ${sessionName} removida!`);

  return { success: true, sessionName };
}
