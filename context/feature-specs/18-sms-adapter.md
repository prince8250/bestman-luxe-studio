# 18 · SMS Adapter

## Goal

One small module that sends SMS, so the provider can change without touching features.

## Depends On

- `02-database-schema.md`

## Scope (Build Only This)

- `lib/sms/index.ts` with `sendSms({ to, message })` returning a typed result.
- One provider implementation for the provider the developer picks, in its own file.
- `SMS_MODE=console` logs instead of sending, for development.
- `lib/phone.ts`: Ghana numbers to E.164, rejecting invalid input, with unit tests.
- `lib/sms/templates.ts`: booking confirmation (studio name, service, date and time, booking code, studio phone), within one SMS length where possible.

## Out Of Scope

- Sending after a booking (spec 35). Owner alerts (spec 19).

## Notes And Rules

- Ask for the provider and credentials first, and read that provider's current API docs.
- Never log full message bodies in production.

## Acceptance Criteria

- [ ] Phone helper tests pass for common Ghana formats.
- [ ] Console mode works; a real test SMS reaches the developer's phone (or say honestly that it was not tested).

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
