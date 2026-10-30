import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PosUser } from "@/lib/auth/types";

// The server-side guards with the signed-in user replaced by a fake, so the
// rules are tested directly on the functions (not just by hiding pages).

const session = vi.hoisted(() => ({ user: null as PosUser | null }));

vi.mock("@/lib/auth/pos-user", () => ({ getPosUser: async () => session.user }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error(`REDIRECT:${path}`), { digest: `NEXT_REDIRECT;replace;${path};307;` });
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) throw error;
  },
}));

const { pageAccess, PermissionError, requirePermission, requirePosUser } = await import("@/lib/auth/require-pos-user");
const { NOT_ALLOWED_MESSAGE, ok, runPosAction } = await import("@/lib/actions/result");

const owner: PosUser = { id: "o", role: "owner", displayName: "Owner" };
const counter: PosUser = { id: "c", role: "counter", displayName: "Abena (counter)" };

beforeEach(() => {
  session.user = null;
});

describe("requirePosUser", () => {
  it("sends a signed-out visitor to the login page", async () => {
    await expect(requirePosUser()).rejects.toThrow("REDIRECT:/pos/login");
  });

  it("returns the signed-in user", async () => {
    session.user = counter;
    await expect(requirePosUser()).resolves.toEqual(counter);
  });
});

describe("requirePermission", () => {
  it("refuses a counter user on an owner-only action", async () => {
    session.user = counter;
    await expect(requirePermission("sale.void")).rejects.toBeInstanceOf(PermissionError);
    await expect(requirePermission("settings.edit")).rejects.toBeInstanceOf(PermissionError);
  });

  it("allows the owner", async () => {
    session.user = owner;
    await expect(requirePermission("sale.void")).resolves.toEqual(owner);
  });
});

describe("pageAccess", () => {
  it("tells an owner-only page that a counter user may not see it", async () => {
    session.user = counter;
    await expect(pageAccess("reports.view")).resolves.toEqual({ user: counter, allowed: false });
    await expect(pageAccess("sale.create")).resolves.toEqual({ user: counter, allowed: true });
  });
});

describe("runPosAction", () => {
  it("never runs the body of an owner-only action for a counter user", async () => {
    session.user = counter;
    const body = vi.fn(async () => ok("done"));
    await expect(runPosAction("catalog.edit", body)).resolves.toEqual({ ok: false, error: NOT_ALLOWED_MESSAGE });
    expect(body).not.toHaveBeenCalled();
  });

  it("never runs the body for a signed-out caller (redirects instead)", async () => {
    const body = vi.fn(async () => ok("done"));
    await expect(runPosAction("sale.create", body)).rejects.toThrow("REDIRECT:/pos/login");
    expect(body).not.toHaveBeenCalled();
  });

  it("runs the body for an allowed role and passes the user", async () => {
    session.user = owner;
    await expect(runPosAction("catalog.edit", async (user) => ok(user.role))).resolves.toEqual({ ok: true, data: "owner" });
  });

  it("turns unexpected errors into a generic message", async () => {
    session.user = owner;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      runPosAction("catalog.edit", async () => {
        throw new Error("boom");
      }),
    ).resolves.toEqual({ ok: false, error: "Something went wrong. Please try again." });
    spy.mockRestore();
  });
});
