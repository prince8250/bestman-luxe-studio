// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  signInAction: vi.fn(async () => ({ error: null, email: "" })),
}));

const { LoginForm } = await import("./login-form");

// React needs this flag to run act() outside a test renderer.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;

afterEach(() => {
  container?.remove();
  container = null;
});

describe("LoginForm", () => {
  it("shows and hides the password with the eye button", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<LoginForm />));

    const password = container.querySelector<HTMLInputElement>("#password")!;
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!;
    expect(password.type).toBe("password");
    expect(toggle.type).toBe("button");

    await act(async () => toggle.click());
    expect(password.type).toBe("text");
    expect(container.querySelector('button[aria-label="Hide password"]')?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => container!.querySelector<HTMLButtonElement>('button[aria-label="Hide password"]')!.click());
    expect(password.type).toBe("password");
    await act(async () => root.unmount());
  });
});
