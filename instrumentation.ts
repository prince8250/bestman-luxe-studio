// Runs once when the Next.js server starts. Validating the environment here
// makes a missing variable stop the server immediately with a clear message.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getPublicEnv } = await import("@/lib/env");
  const { getServerEnv } = await import("@/lib/env.server");
  getPublicEnv();
  getServerEnv();
}
