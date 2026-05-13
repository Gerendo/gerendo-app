// Next.js boot hook. Runs once per server instance, before traffic is served.
// Used here to validate GERENDO_MASTER_KEY eagerly. Without this the env var
// is only checked the first time something encrypts or decrypts — a
// misconfigured deploy would pass health checks and then 500 on the first
// DB request. Failing here means the function cold-start fails loudly.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { encrypt } = await import("@/lib/crypto-storage");
  try {
    encrypt("boot-check", "boot");
  } catch (err) {
    console.error("[boot] GERENDO_MASTER_KEY validation failed:", err);
    throw err;
  }
}
