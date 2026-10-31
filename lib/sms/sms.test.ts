import { afterEach, describe, expect, it, vi } from "vitest";

import { ARKESEL_SEND_URL, sendWithArkesel } from "./arkesel";
import { sendToConsole } from "./console";
import { plainSmsText, smsLength } from "./length";
import { bookingConfirmationSms } from "./templates";
import { maskPhone } from "./types";

const env = vi.hoisted(() => ({ value: { SMS_MODE: "console", SMS_API_KEY: undefined, SMS_SENDER_ID: undefined } as Record<string, unknown> }));
vi.mock("@/lib/env.server", () => ({ getServerEnv: () => env.value }));

const { sendSms } = await import("./index");

const curlyApostrophe = String.fromCharCode(0x2019);
const emDash = String.fromCharCode(0x2014);

afterEach(() => {
  vi.restoreAllMocks();
  env.value = { SMS_MODE: "console" };
});

describe("smsLength", () => {
  it("counts GSM-7 text: 160 characters in one SMS, then 153 per part", () => {
    expect(smsLength("a".repeat(160))).toEqual({ encoding: "gsm7", units: 160, segments: 1 });
    expect(smsLength("a".repeat(161))).toEqual({ encoding: "gsm7", units: 161, segments: 2 });
    expect(smsLength("a".repeat(306)).segments).toBe(2);
    expect(smsLength("Price: £5 & é").encoding).toBe("gsm7");
  });

  it("counts extended characters like € and { as two", () => {
    expect(smsLength("€{}")).toEqual({ encoding: "gsm7", units: 6, segments: 1 });
  });

  it("switches to UCS-2 for any other character: 70 in one SMS, then 67 per part", () => {
    expect(smsLength(`you${curlyApostrophe}re`)).toMatchObject({ encoding: "ucs2", segments: 1 });
    expect(smsLength(`${curlyApostrophe}${"a".repeat(70)}`)).toMatchObject({ encoding: "ucs2", units: 71, segments: 2 });
    expect(smsLength(String.fromCodePoint(0x1f600)).units).toBe(2);
  });
});

describe("plainSmsText", () => {
  it("swaps typographic characters for plain ones and tidies spaces", () => {
    expect(plainSmsText(`  Ama${curlyApostrophe}s  cut ${emDash} 2${String.fromCharCode(0x00a0)}pm${String.fromCharCode(0x2026)} `)).toBe(
      "Ama's cut - 2 pm...",
    );
  });
});

describe("bookingConfirmationSms", () => {
  const details = {
    studioName: "Bestman Luxe Studio",
    service: "Haircuts",
    startsAt: "2026-10-31T14:30:00Z",
    code: "BK-7K4Q",
    studioPhone: "+233244565866",
  };

  it("has the studio, service, date and time, code, and phone in one SMS", () => {
    const text = bookingConfirmationSms(details);
    expect(text).toBe(
      "Bestman Luxe Studio: you're booked for Haircuts on Sat 31 Oct, 14:30. Code BK-7K4Q. To change or cancel, call 024 456 5866.",
    );
    expect(smsLength(text)).toMatchObject({ encoding: "gsm7", segments: 1 });
  });

  it("shortens a long service name to stay in one SMS, and keeps it GSM-7", () => {
    const text = bookingConfirmationSms({
      ...details,
      studioName: `Bestman${curlyApostrophe}s Luxe Studio`,
      service: "Frontal Styling with Wig Installation, Washing and Treatment for Long Hair",
    });
    expect(smsLength(text)).toMatchObject({ encoding: "gsm7", segments: 1 });
    expect(text).toContain("Frontal Styling");
    expect(text).toContain("...");
    expect(text).toContain("Code BK-7K4Q");
  });
});

function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

const request = { to: "+233244565866", message: "Secret booking details", apiKey: "test-key", sender: "BESTMANLUXE", sandbox: false, segments: 1 };

describe("sendWithArkesel", () => {
  it("posts the Arkesel v2 request and returns the message id", async () => {
    const fetchMock = fakeFetch(200, { status: "success", data: [{ recipient: "233244565866", id: "9b752841" }] });
    const result = await sendWithArkesel(request, fetchMock);
    expect(result).toEqual({ ok: true, mode: "live", provider: "arkesel", id: "9b752841", segments: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ARKESEL_SEND_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "api-key": "test-key", "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({ sender: "BESTMANLUXE", message: "Secret booking details", recipients: ["233244565866"] });
  });

  it("adds the sandbox flag in sandbox mode", async () => {
    const fetchMock = fakeFetch(200, { status: "success", data: [{ recipient: "233244565866", id: "s1" }] });
    const result = await sendWithArkesel({ ...request, sandbox: true }, fetchMock);
    expect(result).toMatchObject({ ok: true, mode: "sandbox" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ sandbox: true });
  });

  it.each([
    [402, "Insufficient balance or invalid coverage!", "no_balance"],
    [422, "The message field is required.", "rejected"],
    [403, "Inactive SMS Gateway!", "rejected"],
    [401, "Invalid API key", "not_configured"],
    [500, "SMS request failed!", "provider_error"],
  ])("maps HTTP %i (%s) to %s, and never logs the message text", async (status, message, error) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendWithArkesel(request, fakeFetch(status, { status: "error", message }));
    expect(result).toMatchObject({ ok: false, error });
    expect(JSON.stringify(log.mock.calls)).not.toContain("Secret booking details");
    expect(JSON.stringify(log.mock.calls)).not.toContain("244565866");
  });

  it("reports a number Arkesel lists as invalid", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendWithArkesel(request, fakeFetch(200, { status: "success", data: [{ "invalid numbers": ["233244565866"] }] }));
    expect(result).toMatchObject({ ok: false, error: "rejected" });
  });

  it("returns a network error instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await sendWithArkesel(request, failing)).toMatchObject({ ok: false, error: "network" });
  });
});

describe("console mode", () => {
  it("logs the text in development and only a masked number in production", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const length = smsLength("Hello");
    expect(sendToConsole("+233244565866", "Hello", length, false)).toMatchObject({ ok: true, mode: "console", segments: 1 });
    expect(log.mock.calls[0][0]).toContain("Hello");
    sendToConsole("+233244565866", "Hello", length, true);
    expect(log.mock.calls[1][0]).not.toContain("Hello");
    expect(log.mock.calls[1][0]).toContain(maskPhone("+233244565866"));
    expect(maskPhone("+233244565866")).toBe("+233******866");
  });
});

describe("sendSms", () => {
  it("normalises the number and sends through the console in console mode", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendSms({ to: "024 456 5866", message: " Hello " })).toMatchObject({ ok: true, mode: "console", provider: "console" });
  });

  it("refuses a bad number, an empty text, or a text longer than 3 SMS", async () => {
    expect(await sendSms({ to: "12345", message: "Hi" })).toMatchObject({ ok: false, error: "invalid_phone" });
    expect(await sendSms({ to: "0244565866", message: "   " })).toMatchObject({ ok: false, error: "empty_message" });
    expect(await sendSms({ to: "0244565866", message: "a".repeat(460) })).toMatchObject({ ok: false, error: "too_long" });
  });

  it("sends through Arkesel in live mode", async () => {
    env.value = { SMS_MODE: "live", SMS_API_KEY: "test-key", SMS_SENDER_ID: "BESTMANLUXE" };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "success", data: [{ recipient: "233244565866", id: "x1" }] })));
    expect(await sendSms({ to: "0244565866", message: "Hello" })).toMatchObject({ ok: true, mode: "live", provider: "arkesel", id: "x1" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
