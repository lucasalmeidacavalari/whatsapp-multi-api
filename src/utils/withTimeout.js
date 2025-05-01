export function withTimeout(promise, timeoutMs, timeoutMessage = "Timed Out") {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }
  