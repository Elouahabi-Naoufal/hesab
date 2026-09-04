export async function register() {
  // Enable WAL mode at startup (only on server)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enableWalMode, ensureDataDir } = await import("./lib/prisma");
    ensureDataDir();
    await enableWalMode();
  }
}
