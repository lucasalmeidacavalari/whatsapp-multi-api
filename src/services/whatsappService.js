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
const encerradasManual = new Set();

export async function connectSession({ cpfcnpj, nome }) {
  try {
    let empresa = await prisma.tempresa.findUnique({ where: { cpfcnpj } });
    if (!empresa) {
      empresa = await prisma.tempresa.create({ data: { cpfcnpj } });
    }

    let sessaoExistente = await prisma.tsession.findFirst({
      where: {
        empresaId: empresa.id,
        status: { in: ["INATIVA", "EXPIRADA", "ERRO", "ATIVA"] },
      },
    });

    let sessionName;
    let sessionDir;
    let reuse = false;

    if (sessaoExistente) {
      const pathExists = await fs
        .access(sessaoExistente.sessionPath)
        .then(() => true)
        .catch(() => false);

      if (
        pathExists &&
        sessaoExistente.status !== "EXPIRADA" &&
        sessaoExistente.status !== "ERRO"
      ) {
        sessionName = sessaoExistente.sessionName;
        sessionDir = sessaoExistente.sessionPath;
        reuse = true;
      } else {
        try {
          await fs.rm(sessaoExistente.sessionPath, {
            recursive: true,
            force: true,
          });
          console.log(
            `🧹 Pasta da sessão ${sessaoExistente.sessionName} removida para regeneração.`
          );
        } catch (err) {
          console.warn("⚠️ Erro ao limpar sessão antiga:", err.message);
        }

        sessionName = sessaoExistente.sessionName;
        sessionDir = path.join(sessionsPath, sessionName);
        await fs.mkdir(sessionDir, { recursive: true });
        reuse = false;
      }
    }

    if (!sessionName) {
      sessionName = uuidv4();
      sessionDir = path.join(sessionsPath, sessionName);
      await fs.mkdir(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("⏱ Timeout ao conectar sessão");
        return resolve({ status: "timeout", sessionName });
      }, 60000);

      sock.ev.on("connection.update", async (update) => {
        try {
          const { connection, qr, lastDisconnect } = update;

          if (qr) {
            const qrBase64 = await qrcode.toDataURL(qr);
            clearTimeout(timeout);
            return resolve({
              sessionName,
              reuse,
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

            return resolve({
              sessionName,
              reuse,
              numero,
              status: "connected",
            });
          }

          if (connection === "close" && !qr) {
            clearTimeout(timeout);
            const reasonCode = new Boom(lastDisconnect?.error)?.output
              ?.statusCode;
            const reasonText = isBoom(lastDisconnect?.error)
              ? lastDisconnect.error.message
              : "Desconhecido";

            console.log(
              `⚠️ Sessão ${sessionName} desconectada (close). Código: ${reasonCode} - ${reasonText}`
            );

            if (reasonCode === 515 || reasonCode === 408) {
              console.log(
                "🔁 Reconectando sessão com iniciarSocket após erro 515/408..."
              );
              setTimeout(() => {
                iniciarSocket({
                  sessionDir,
                  sessionName,
                  empresaId: empresa.id,
                  nomeCelular: nome,
                });
              }, 10000);

              return resolve({
                sessionName,
                reuse,
                status: "reconnect_pending",
                motivo: `Erro ${reasonCode}: Reconexão iniciada com delay.`,
              });
            }

            return resolve({
              sessionName,
              reuse,
              status: "disconnected",
              motivo: reasonText,
            });
          }
        } catch (err) {
          clearTimeout(timeout);
          console.error("❌ Erro interno em connection.update:", err);
          return resolve({
            sessionName,
            reuse,
            status: "erro",
            detalhe: err.message,
          });
        }
      });

      sock.ev.on("creds.update", saveCreds);
    });
  } catch (error) {
    console.error("❌ Erro geral no connectSession:", error);
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
      if (encerradasManual.has(sessionName)) {
        encerradasManual.delete(sessionName);
        console.log(
          `🟢 Sessão ${sessionName} encerrada manualmente (status já atualizado).`
        );
        return;
      }
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
