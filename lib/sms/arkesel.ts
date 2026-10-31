import { maskPhone, smsFailure, type SmsResult } from "@/lib/sms/types";

// Arkesel SMS API v2 (https://developers.arkesel.com, "SMS V2 > Send SMS"):
//   POST https://sms.arkesel.com/api/v2/sms/send
//   header api-key: <key from Dashboard > SMS API>
//   body { sender, message, recipients: ["233244565866"], sandbox? }
// A success answers { status: "success", data: [{ recipient, id }] }; errors
// answer { status: "error", message } with 402 (no balance or coverage), 403
// (inactive gateway), 422 (bad request), or 500. With sandbox: true the
// message is accepted and listed in the Arkesel history but never delivered
// or billed.
//
// The only file that knows Arkesel. Another provider would be another file
// like this one, chosen in lib/sms/index.ts.

export const ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send";
const TIMEOUT_MS = 15_000;

export interface ArkeselRequest {
  /** E.164, for example "+233244565866". */
  to: string;
  message: string;
  apiKey: string;
  sender: string;
  sandbox: boolean;
  segments: number;
}

type Fetch = typeof fetch;

function errorFor(status: number, providerMessage: string): SmsResult {
  if (status === 401 || /api key|unauthori[sz]ed|sender id/i.test(providerMessage)) {
    return smsFailure("not_configured", `Arkesel refused the API key or sender ID: ${providerMessage}`);
  }
  if (status === 402) return smsFailure("no_balance", `Arkesel: ${providerMessage}`);
  if (status === 403 || status === 422) return smsFailure("rejected", `Arkesel refused the message: ${providerMessage}`);
  return smsFailure("provider_error", `Arkesel failed: ${providerMessage}`);
}

export async function sendWithArkesel(request: ArkeselRequest, fetchImpl: Fetch = fetch): Promise<SmsResult> {
  const recipient = request.to.replace(/^\+/, ""); // Arkesel takes 233... without the +
  let response: Response;
  try {
    response = await fetchImpl(ARKESEL_SEND_URL, {
      method: "POST",
      headers: { "api-key": request.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: request.sender,
        message: request.message,
        recipients: [recipient],
        ...(request.sandbox ? { sandbox: true } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`[sms:arkesel] to ${maskPhone(request.to)}: request failed`, error instanceof Error ? error.name : error);
    return smsFailure("network", "Could not reach Arkesel. Check the internet connection.");
  }

  const body: unknown = await response.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const providerMessage = typeof record.message === "string" ? record.message.slice(0, 200) : `HTTP ${response.status}`;

  if (!response.ok || record.status !== "success") {
    // Never the message text: only the status and Arkesel's own message.
    console.error(`[sms:arkesel] to ${maskPhone(request.to)}: ${response.status} ${providerMessage}`);
    return errorFor(response.status, providerMessage);
  }

  const data = Array.isArray(record.data) ? (record.data as Record<string, unknown>[]) : [];
  // Arkesel lists numbers it would not send to under "invalid numbers".
  const refused = data.some((row) => Array.isArray(row["invalid numbers"]) && (row["invalid numbers"] as unknown[]).includes(recipient));
  const sent =
    data.find((row) => row.recipient === recipient && typeof row.id === "string") ?? data.find((row) => typeof row.id === "string");
  if (refused) {
    console.error(`[sms:arkesel] to ${maskPhone(request.to)}: number not accepted`);
    return smsFailure("rejected", "Arkesel did not accept the phone number.");
  }
  return {
    ok: true,
    mode: request.sandbox ? "sandbox" : "live",
    provider: "arkesel",
    id: sent ? (sent.id as string) : null,
    segments: request.segments,
  };
}
