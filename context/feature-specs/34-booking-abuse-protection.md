# 34 · Booking Abuse Protection

## Goal

Stop bots and fake bookings, since there is no login and no deposit.

## Depends On

- `33-booking-creation.md`
- `13-customers.md`

## Who Can Use This

- Public website visitors. No login of any kind.
- Blocking numbers is done by the owner (spec 13).

## Scope (Build Only This)

- Cloudflare Turnstile on the Confirm step, verified on the server before anything is written.
- Rate limits in `rate_limits`: at most **10 booking attempts per IP** and **5 per phone number** per fixed one-hour window. The window starts on the hour (`window_start` = the attempt time truncated to the hour), the counter for a key resets when a new hour starts, and old rows are deleted after a day. Keys are hashed (`ip:<hash>`, `phone:<hash>`). The limits are constants in one file so they are easy to change.
- Maximum 2 upcoming confirmed appointments per phone (default), with a friendly "please call the studio" message.
- Blocked numbers (from spec 13) cannot book online.

## Out Of Scope

- OTP (never part of this project). Deposits (`later/`).

## Notes And Rules

- Ask the developer to create the Turnstile site and keys. Keep the secret server-only.
- Messages never reveal which rule triggered.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] Without a valid Turnstile token nothing is written.
- [ ] Limits trigger at the documented thresholds.
- [ ] Blocked numbers cannot book.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
