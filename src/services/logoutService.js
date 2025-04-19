import { useMultiFileAuthState, makeWASocket } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sessionsPath = path.resolve("sessions");

export async function logoutSession(sessionName) {
  const session = await prisma.tsession.findFirst({ where: { sessionName } });

  if (!session) {
    throw new Error('Sessão não encontrada');
  }

  const sessionDir = session.sessionPath;

  try {
    await fs.access(sessionDir);
  } catch {
    throw new Error('Diretório da sessão não encontrado');
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);

  // Aguarda conexão abrir antes de deslogar
  await new Promise((resolve) => {
    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        sock.logout();
        resolve();
      }
    });
  });

  // Remove do banco
  await prisma.tsession.delete({ where: { id: session.id } });

  // Remove arquivos da sessão (opcional)
  await fs.rm(sessionDir, { recursive: true, force: true });

  return { success: true, sessionName };
}
