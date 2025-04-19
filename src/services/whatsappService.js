import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { v4 as uuidv4 } from "uuid";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import prisma from "../../prisma/client.js";

const sessionsPath = path.resolve("sessions");

export async function connectSession({ cpfcnpj, numero }) {
  const sessionName = uuidv4(); 
  const sessionDir = path.join(sessionsPath, sessionName);

  fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  return new Promise((resolve, reject) => {
    sock.ev.on("connection.update", async (update) => {
      const { connection, qr } = update;

      if (qr) {
        const qrBase64 = await qrcode.toDataURL(qr);
        resolve({
          sessionName,
          qr,
          qrBase64,
        });
      }

      if (connection === "open") {
        try {
          const empresa = await prisma.tempresa.findUnique({
            where: { cpfcnpj },
          });

          if (!empresa) {
            throw new Error("Empresa não encontrada");
          }

          await prisma.tsession.create({
            data: {
              empresaId: empresa.id,
              sessionName,
              numero,
              sessionPath: sessionDir,
              isConnected: true,
            },
          });

          console.log(`Sessão ${sessionName} conectada`);
        } catch (err) {
          console.error("Erro ao salvar sessão:", err);
        }
      }

      if (connection === "close") {
        const reason = new Boom(update.lastDisconnect?.error)?.output
          ?.statusCode;
        if (reason !== DisconnectReason.loggedOut) {
          connectSession({ cpfcnpj, numero }); // tenta reconectar
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
  });
}
