// Sends one test SMS through lib/sms with the settings in .env.local (spec 18).
//
//   npm run sms:test -- 024 456 5866            console or sandbox mode
//   npm run sms:test -- 024 456 5866 --live     live mode (a real, paid SMS)
//
// SMS_MODE decides what happens: console logs it, sandbox sends it to
// Arkesel's test mode (listed in the Arkesel SMS history, never delivered or
// billed), live delivers it. The API key is read from .env.local and never
// printed.

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const live = args.includes("--live");
const to = args.filter((arg) => arg !== "--live").join(" ").trim();

if (!to) {
  console.error("Usage: npm run sms:test -- <phone number> [--live]");
  process.exit(1);
}

process.loadEnvFile(path.join(root, ".env.local"));
const mode = process.env.SMS_MODE || "console";
if (mode === "live" && !live) {
  console.error("SMS_MODE is live: this sends a real SMS and uses credit. Add --live to confirm.");
  process.exit(1);
}

// `server-only` throws outside Next.js; here it is replaced by an empty module.
const jiti = createJiti(import.meta.url, {
  alias: { "@": root, "server-only": path.join(root, "tests", "empty-module.ts") },
});
const { sendSms } = await jiti.import(path.join(root, "lib", "sms", "index.ts"));

console.log(`SMS_MODE=${mode}, sender ID ${process.env.SMS_SENDER_ID || "(not set)"}`);
const result = await sendSms({
  to,
  message: "Bestman Luxe Studio: this is a test SMS from the POS setup. No reply needed.",
});
console.log(result);
process.exit(result.ok ? 0 : 1);
