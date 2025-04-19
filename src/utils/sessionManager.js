function waitForConnectionOpen(sock) {
  return new Promise((resolve) => {
    const listener = (update) => {
      if (update.connection === "open") {
        sock.ev.off("connection.update", listener);
        resolve();
      }
    };
    sock.ev.on("connection.update", listener);
  });
}

export { waitForConnectionOpen };
