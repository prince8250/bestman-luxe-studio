import { describe, expect, it } from "vitest";

import { EnvError, parsePublicEnv, parseServerEnv } from "@/lib/env";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parsePublicEnv", () => {
  it("accepts a complete set and treats empty optional values as missing", () => {
    const env = parsePublicEnv({ ...validPublic, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined();
  });

  it("names every missing required variable", () => {
    expect(() => parsePublicEnv({})).toThrow(EnvError);
    try {
      parsePublicEnv({});
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      expect(message).toContain("NEXT_PUBLIC_SITE_URL");
    }
  });
});

describe("parseServerEnv", () => {
  it("requires the service-role key and defaults SMS to console mode", () => {
    expect(() => parseServerEnv({})).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    const env = parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret" });
    expect(env.SMS_MODE).toBe("console");
    expect(env.BACKUP_EXPORT_TOKEN).toBeUndefined();
  });

  it("rejects short backup tokens and long sender IDs", () => {
    expect(() =>
      parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret", BACKUP_EXPORT_TOKEN: "short" }),
    ).toThrow(/BACKUP_EXPORT_TOKEN/);
    expect(() =>
      parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret", SMS_SENDER_ID: "TwelveLetter" }),
    ).toThrow(/SMS_SENDER_ID/);
  });

  it("needs the SMS key and sender ID before sending through Arkesel", () => {
    expect(() => parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret", SMS_MODE: "live" })).toThrow(
      /SMS_API_KEY: is required when SMS_MODE is live[\s\S]*SMS_SENDER_ID/,
    );
    expect(() => parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret", SMS_MODE: "sandbox", SMS_API_KEY: "key" })).toThrow(
      /SMS_SENDER_ID: is required when SMS_MODE is sandbox/,
    );
    const env = parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret", SMS_MODE: "live", SMS_API_KEY: "key", SMS_SENDER_ID: "BESTMANLUXE" });
    expect(env.SMS_MODE).toBe("live");
  });
});
