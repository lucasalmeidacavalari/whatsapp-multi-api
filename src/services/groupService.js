import { PrismaClient } from "@prisma/client";
import { getOrCreateSession } from "../utils/sessionManager.js";

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

    const sock = await getOrCreateSession(sessionName, session.sessionPath);
    if (!sock) {
      console.warn("Não foi possível obter sessão válida:", sessionName);
      return [];
    }

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
  } catch (error) {
    console.error("Erro geral na função getGroups:", error);
    return [];
  }
}
