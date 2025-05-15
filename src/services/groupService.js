import { PrismaClient } from "@prisma/client";
import { useMultiFileAuthState, makeWASocket } from "@whiskeysockets/baileys";
import fs from "fs/promises";
import { waitForConnectionOpen } from "../utils/sessionManager.js";

const prisma = new PrismaClient();

export async function getGroups(sessionName) {
  try {
    const session = await prisma.tsession.findFirst({
      where: { sessionName },
    });

    if (!session || !session.isConnected) {
      console.warn("Sessão não encontrada ou desconectada:", sessionName);
      return [];
    }

    const sessionDir = session.sessionPath;

    try {
      await fs.access(sessionDir);
    } catch (err) {
      console.error("Erro ao acessar diretório da sessão:", err);
      return [];
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({ auth: state });
    sock.ev.on("creds.update", saveCreds);

    try {
      await waitForConnectionOpen(sock);
    } catch (err) {
      console.error("Erro ao aguardar conexão com o WhatsApp:", err);
      return [];
    }

    try {
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
    } catch (err) {
      console.error("Erro ao buscar grupos:", err);
      return [];
    }
  } catch (error) {
    console.error("Erro geral na função getGroups:", error);
    return [];
  }
}
