import { PrismaClient } from "@prisma/client";
import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import fs from "fs/promises";
import { waitForConnectionOpen } from "../utils/sessionManager.js";

const prisma = new PrismaClient();

export async function getGroups(sessionName) {
  const session = await prisma.tsession.findFirst({
    where: { sessionName },
  });

  if (!session || !session.isConnected) {
    throw new Error("Sessão não encontrada ou desconectada");
  }

  const sessionDir = session.sessionPath;
  await fs.access(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({ auth: state });
  sock.ev.on("creds.update", saveCreds);

  await waitForConnectionOpen(sock);

  const groupDataMap = await sock.groupFetchAllParticipating();
  const groupList = Object.values(groupDataMap);

  return groupList.map((group) => {
    const rawParticipants = group.participants || [];

    const participants = rawParticipants.map((p) => p.id.split("@")[0]);

    return {
      id: group.id,
      name: group.subject,
      participants,
      participantsCount: participants.length,
    };
  });
}
