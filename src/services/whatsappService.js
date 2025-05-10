import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { Boom, isBoom } from "@hapi/boom";
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
      empresa = await prisma.tempresa.create({ data: { cpfcnpj } });
    }

    const sessionName = uuidv4();
    const sessionDir = path.join(sessionsPath, sessionName);
    await fs.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout ao conectar")),
        30000
      );

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

            const exists = await prisma.tsession.findFirst({
              where: { empresaId: empresa.id, numero },
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
            clearTimeout(timeout);

            const reasonCode = new Boom(lastDisconnect?.error)?.output
              ?.statusCode;
            const reasonText = isBoom(lastDisconnect?.error)
              ? lastDisconnect.error.message
              : "Desconhecido";

            console.log(
              `Conexão encerrada. Motivo: ${reasonCode} - ${reasonText}`
            );

            if (reasonCode === 408) {
              console.warn(
                "Timeout detectado (408). Removendo pasta da sessão..."
              );

              try {
                await fs.rm(sessionDir, { recursive: true, force: true });
                console.log(`✅ Pasta da sessão ${sessionName} removida.`);
              } catch (err) {
                console.error("Erro ao remover pasta da sessão:", err);
              }

              return;
            }

            if (reasonCode === 515) {
              console.log("Erro 515: tentando reconectar...");
              setTimeout(() => {
                iniciarSocket({
                  sessionDir,
                  sessionName,
                  empresaId: empresa.id,
                  nomeCelular: nome,
                });
              }, 10000);
              return;
            }

            if (reasonCode === 401) {
              try {
                const session = await prisma.tsession.findFirst({
                  where: { sessionName },
                  select: { empresaId: true, sessionPath: true },
                });

                if (session) {
                  await prisma.tsession.delete({
                    where: {
                      empresaId_sessionName: {
                        empresaId: session.empresaId,
                        sessionName,
                      },
                    },
                  });
                  await fs.rm(session.sessionPath, {
                    recursive: true,
                    force: true,
                  });
                  console.log(`Pasta da sessão ${sessionName} removida!`);
                } else {
                  console.log("Sessão não encontrada");
                }
              } catch (err) {
                console.error("Erro ao remover sessão:", err);
              }
            }
          }
        } catch (err) {
          console.error("Erro dentro de connection.update:", err);
          reject(err);
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
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });

  sock.ev.on("connection.update", async (update) => {
    try {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        const numero = sock.user.id.split(":")[0];

        const exists = await prisma.tsession.findFirst({
          where: { empresaId, numero },
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
            iniciarSocket({ sessionDir, sessionName, empresaId, nomeCelular });
          }, 10000);
        }

        if (reason === 401) {
          const session = await prisma.tsession.findFirst({
            where: { sessionName },
            select: { empresaId: true, sessionPath: true },
          });

          if (session) {
            await prisma.tsession.delete({
              where: {
                empresaId_sessionName: {
                  empresaId: session.empresaId,
                  sessionName,
                },
              },
            });
            await fs.rm(session.sessionPath, { recursive: true, force: true });
            console.log(`Pasta da sessão ${sessionName} removida!`);
          } else {
            console.log("Sessão não encontrada");
          }
        }
      }
    } catch (err) {
      console.error("Erro interno no iniciarSocket:", err);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}
