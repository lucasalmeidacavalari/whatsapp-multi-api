import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';

export async function loadSession(sessionPath) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);
  return sock;
}
