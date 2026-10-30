import { z } from "zod";

// Environment variables are validated with Zod so a missing or malformed value
// stops the app at start-up with a clear message, instead of failing later in
// the middle of a sale.
//
// Two groups:
// - public: prefixed NEXT_PUBLIC_, inlined into the browser bundle at build time.
//   Only values that are safe for anyone to see belong here.
// - server: secrets. Read only through `lib/env.server.ts`, which is server-only.

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// A bearer token must be long enough that guessing it is hopeless.
const optionalToken = optionalString.refine(
  (value) => value === undefined || value.length >= 32,
  "must be at least 32 characters (generate one with: openssl rand -hex 32)",
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
  // Needed from spec 34 (booking abuse protection).
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Needed from spec 20 (backup export endpoints).
  BACKUP_EXPORT_TOKEN: optionalToken,
  // Needed from spec 22 (weekly cloud backup).
  BACKUP_WEBHOOK_TOKEN: optionalToken,
  // Needed from spec 18 (SMS adapter). `console` logs messages instead of sending.
  SMS_MODE: z.enum(["console", "live"]).default("console"),
  SMS_API_KEY: optionalString,
  // Ghana SMS sender IDs are at most 11 characters.
  SMS_SENDER_ID: optionalString.refine(
    (value) => value === undefined || value.length <= 11,
    "must be 11 characters or fewer",
  ),
  // Needed from spec 34.
  TURNSTILE_SECRET_KEY: optionalString,
  // Needed from spec 19 (scheduled owner jobs).
  CRON_SECRET: optionalToken,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  constructor(group: string, issues: z.core.$ZodIssue[]) {
    const lines = issues.map(
      (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    super(
      `Invalid ${group} environment variables:\n${lines.join("\n")}\n` +
        "Copy .env.example to .env.local and fill in the values.",
    );
    this.name = "EnvError";
  }
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) throw new EnvError("public", result.error.issues);
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) throw new EnvError("server", result.error.issues);
  return result.data;
}

let cachedPublicEnv: PublicEnv | undefined;

// Each NEXT_PUBLIC_ variable is named explicitly: Next.js only inlines
// `process.env.NEXT_PUBLIC_X` written out in full, not dynamic lookups.
export function getPublicEnv(): PublicEnv {
  cachedPublicEnv ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  });
  return cachedPublicEnv;
}
