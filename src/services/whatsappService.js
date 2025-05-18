import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { Boom, isBoom } from "@hapi/boom";
import { v4 as uuidv4 } from "uuid";
import qrcode from "qrcode";
import fs from "fs/promises";
import path from "path";
import { PrismaClient, SessaoStatus } from "@prisma/client";
import { sessions } from "../utils/sessionManager.js";

const prisma = new PrismaClient();
const sessionsPath = path.resolve("sessions");

export async function connectSession({ cpfcnpj, nome }) {
  try {
    let empresa = await prisma.tempresa.findUnique({ where: { cpfcnpj } });
    if (!empresa) empresa = await prisma.tempresa.create({ data: { cpfcnpj } });

    // Tenta reutilizar sessão existente
    let sessao = await prisma.tsession.findFirst({
      where: {
        empresaId: empresa.id,
        status: { in: ["INATIVA", "ATIVA"] },
      },
    });

    const sessionName = sessao?.sessionName ?? uuidv4();
    const sessionDir = path.join(sessionsPath, sessionName);
    await fs.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("Timeout ao conectar sessão");
        return resolve({ status: "timeout", sessionName });
      }, 30000);

      sock.ev.on("connection.update", async (update) => {
        try {
          const { connection, qr, lastDisconnect } = update;

          if (qr) {
            const qrBase64 = await qrcode.toDataURL(qr);
            clearTimeout(timeout);
            return resolve({
              sessionName,
              qr,
              qrBase64,
              status: "qr_generated",
            });
          }

          if (connection === "open") {
            clearTimeout(timeout);
            const numero = sock.user.id.split(":")[0];

            await prisma.tsession.upsert({
              where: {
                empresaId_sessionName: {
                  empresaId: empresa.id,
                  sessionName,
                },
              },
              update: {
                numero,
                nomeCelular: nome,
                isConnected: true,
                status: "ATIVA",
                ultimoUso: new Date(),
              },
              create: {
                empresaId: empresa.id,
                sessionName,
                numero,
                sessionPath: sessionDir,
                nomeCelular: nome,
                isConnected: true,
                status: "ATIVA",
                ultimoUso: new Date(),
              },
            });

            sessions.set(sessionName, { sock, lastUsed: Date.now() });

            console.log(
              `✅ Sessão ${sessionName} conectada com o número ${numero}`
            );
          }

          if (connection === "close") {
            clearTimeout(timeout);
            const reasonCode = new Boom(lastDisconnect?.error)?.output
              ?.statusCode;
            const reasonText = isBoom(lastDisconnect?.error)
              ? lastDisconnect.error.message
              : "Desconhecido";

            console.log(
              `⚠️ Conexão encerrada. Motivo: ${reasonCode} - ${reasonText}`
            );

            let status = SessaoStatus.ERRO;
            if (reasonCode === 408) status = "INATIVA";
            if (reasonCode === 401) status = "EXPIRADA";

            await prisma.tsession.updateMany({
              where: { sessionName },
              data: {
                isConnected: false,
                status,
                ultimoUso: new Date(),
              },
            });

            sessions.delete(sessionName);

            if (reasonCode === 515 || reasonCode === 408) {
              console.log("Tentando reconectar...");
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
        } catch (err) {
          console.error("Erro dentro de connection.update:", err);
        }
      });

      sock.ev.on("creds.update", saveCreds);
    });
  } catch (error) {
    console.error("Erro geral no connectSession:", error);
    return {
      status: "erro",
      mensagem: "Falha ao inicializar sessão",
      detalhe: error?.message,
    };
  }
}

async function iniciarSocket({
  sessionDir,
  sessionName,
  empresaId,
  nomeCelular = "Desconhecido",
}) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    sock.ev.on("connection.update", async (update) => {
      try {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          const numero = sock.user.id.split(":")[0];

          await prisma.tsession.upsert({
            where: {
              empresaId_sessionName: {
                empresaId,
                sessionName,
              },
            },
            update: {
              numero,
              nomeCelular,
              isConnected: true,
              status: "ATIVA",
              ultimoUso: new Date(),
            },
            create: {
              empresaId,
              sessionName,
              numero,
              sessionPath: sessionDir,
              nomeCelular,
              isConnected: true,
              status: "ATIVA",
              ultimoUso: new Date(),
            },
          });

          sessions.set(sessionName, { sock, lastUsed: Date.now() });

          console.log(
            `✅ Sessão ${sessionName} conectada com o número ${numero}`
          );
        }

        if (connection === "close") {
          const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
          console.log(`⚠️ Conexão encerrada. Motivo: ${reason}`);

          let status = SessaoStatus.ERRO;
          if (reason === 408) status = "INATIVA";
          if (reason === 401) status = "EXPIRADA";

          await prisma.tsession.updateMany({
            where: { sessionName },
            data: {
              isConnected: false,
              status,
              ultimoUso: new Date(),
            },
          });

          sessions.delete(sessionName);

          if (reason === 515 || reason === 408) {
            console.log("Tentando reconectar com delay...");
            setTimeout(() => {
              iniciarSocket({
                sessionDir,
                sessionName,
                empresaId,
                nomeCelular,
              });
            }, 10000);
          }
        }
      } catch (err) {
        console.error("Erro interno no iniciarSocket:", err);
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("Erro ao iniciar socket:", err);
  }
}
