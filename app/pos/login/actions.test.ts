import { beforeEach, describe, expect, it, vi } from "vitest";

// The sign-in action with Supabase replaced by small fakes, so every path
// (wrong password, missing or deactivated profile, lockout, success per role)
// is checked without a network.

const state = vi.hoisted(() => ({
  signInResult: { data: { user: null as { id: string } | null }, error: null as { message: string } | null },
  profile: null as { role: string; active: boolean } | null,
  failures: 0,
  eventError: null as { message: string } | null,
  calls: [] as string[],
  insertedEvents: [] as unknown[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.9" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string) => {
      state.calls.push(name);
      return { data: name === "rate_limit_count" ? state.failures : null, error: null };
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signInWithPassword: async () => state.signInResult,
      signOut: async () => {
        state.calls.push("signOut");
        return { error: null };
      },
    },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: null }) }) }) };
      }
      return {
        insert: async (row: unknown) => {
          state.insertedEvents.push(row);
          return { error: state.eventError };
        },
      };
    },
  }),
}));

const { signInAction } = await import("./actions");

function form(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

const initial = { error: null, email: "" };

beforeEach(() => {
  state.signInResult = { data: { user: null }, error: null };
  state.profile = null;
  state.failures = 0;
  state.eventError = null;
  state.calls = [];
  state.insertedEvents = [];
});

describe("signInAction", () => {
  it("asks for both fields when the input is invalid", async () => {
    const result = await signInAction(initial, form("not-an-email", ""));
    expect(result.error).toBe("Enter your email and password.");
    expect(state.calls).toEqual([]);
  });

  it("gives a generic error on wrong credentials and records the failure", async () => {
    state.signInResult = { data: { user: null }, error: { message: "Invalid login credentials" } };
    const result = await signInAction(initial, form("owner@bestman.test", "wrong"));
    expect(result.error).toMatch(/^Sign-in failed/);
    expect(result.email).toBe("owner@bestman.test");
    expect(state.calls.filter((call) => call === "rate_limit_hit")).toHaveLength(2);
  });

  it("signs out an auth user with no POS profile, with the same generic error", async () => {
    state.signInResult = { data: { user: { id: "u1" } }, error: null };
    state.profile = null;
    const result = await signInAction(initial, form("someone@bestman.test", "right"));
    expect(result.error).toMatch(/^Sign-in failed/);
    expect(state.calls).toContain("signOut");
    expect(state.insertedEvents).toHaveLength(0);
  });

  it("signs out a deactivated profile", async () => {
    state.signInResult = { data: { user: { id: "u2" } }, error: null };
    state.profile = { role: "counter", active: false };
    const result = await signInAction(initial, form("former@bestman.test", "right"));
    expect(result.error).toMatch(/^Sign-in failed/);
    expect(state.calls).toContain("signOut");
  });

  it("refuses once the window is locked, without trying the password", async () => {
    state.failures = 10;
    state.signInResult = { data: { user: { id: "u3" } }, error: null };
    const result = await signInAction(initial, form("owner@bestman.test", "right"));
    expect(result.error).toMatch(/Too many attempts/);
    expect(state.insertedEvents).toHaveLength(0);
  });

  it("records the sign-in and sends the owner to the dashboard", async () => {
    state.signInResult = { data: { user: { id: "owner-id" } }, error: null };
    state.profile = { role: "owner", active: true };
    await expect(signInAction(initial, form("owner@bestman.test", "right"))).rejects.toThrow("REDIRECT:/pos");
    expect(state.insertedEvents).toEqual([{ profile_id: "owner-id", user_agent: "vitest" }]);
    expect(state.calls).toContain("rate_limit_clear");
  });

  it("sends the counter to New sale", async () => {
    state.signInResult = { data: { user: { id: "counter-id" } }, error: null };
    state.profile = { role: "counter", active: true };
    await expect(signInAction(initial, form("counter@bestman.test", "right"))).rejects.toThrow("REDIRECT:/pos/sale/new");
  });

  it("does not let the sign-in through when it cannot be recorded", async () => {
    state.signInResult = { data: { user: { id: "owner-id" } }, error: null };
    state.profile = { role: "owner", active: true };
    state.eventError = { message: "insert failed" };
    const result = await signInAction(initial, form("owner@bestman.test", "right"));
    expect(result.error).toMatch(/Could not sign in/);
    expect(state.calls).toContain("signOut");
  });
});
