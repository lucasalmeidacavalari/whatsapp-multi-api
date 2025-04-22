import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { v4 as uuidv4 } from "uuid";
import qrcode from "qrcode";
import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionsPath = path.resolve("sessions");

export async function connectSession({ cpfcnpj, nome }) {
  try {
    let empresa = await prisma.tempresa.findUnique({ where: { cpfcnpj } });

    if (!empresa) {
      empresa = await prisma.tempresa.create({
        data: { cpfcnpj },
      });
    }

    const sessionName = uuidv4();
    const sessionDir = path.join(sessionsPath, sessionName);
    await fs.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    return new Promise((resolve, reject) => {
      sock.ev.on("connection.update", async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          const qrBase64 = await qrcode.toDataURL(qr);
          return resolve({
            sessionName,
            qr,
            qrBase64,
            status: "qr_generated",
          });
        }

        if (connection === "open") {
          const numero = sock.user.id.split(":")[0];

          const exists = await prisma.tsession.findFirst({
            where: {
              empresaId: empresa.id,
              numero,
            },
          });

          if (!exists) {
            await prisma.tsession.create({
              data: {
                empresaId: empresa.id,
                sessionName,
                numero,
                sessionPath: sessionDir,
                nomeCelular: nome,
                isConnected: true,
              },
            });
            console.log(
              `Sessão ${sessionName} conectada com o número ${numero}`
            );
          } else {
            console.log(
              `Sessão ${sessionName} já cadastrada para o número ${exists.numero}`
            );
          }
        }

        if (connection === "close") {
          const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
          console.log("Conexão encerrada. Motivo:", reason);

          if (reason === 515) {
            console.log("Erro 515: iniciando loop de reconexão...");
            setTimeout(() => {
              iniciarSocket({
                sessionDir,
                sessionName,
                empresaId: empresa.id,
                nomeCelular: nome,
              });
            }, 10000);
          }
        }
      });

      sock.ev.on("creds.update", saveCreds);
    });
  } catch (error) {
    console.error("Erro geral no connectSession:", error);
    throw error;
  }
}

async function iniciarSocket({
  sessionDir,
  sessionName,
  empresaId,
  nomeCelular = "Desconhecido",
}) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      const numero = sock.user.id.split(":")[0];

      const exists = await prisma.tsession.findFirst({
        where: {
          empresaId,
          numero,
        },
      });

      if (!exists) {
        await prisma.tsession.create({
          data: {
            empresaId,
            sessionName,
            numero,
            sessionPath: sessionDir,
            nomeCelular,
            isConnected: true,
          },
        });

        console.log(`Sessão ${sessionName} conectada com o número ${numero}`);
      } else {
        console.log(
          `Sessão ${sessionName} já cadastrada para número ${exists.numero}`
        );
      }
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log("Conexão encerrada. Motivo:", reason);

      if (reason === 515) {
        console.log("Erro 515: tentando reconectar com delay...");
        setTimeout(() => {
          iniciarSocket({
            sessionDir,
            sessionName,
            empresaId: empresa.id,
            nomeCelular: nome,
          });
        }, 10000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}
