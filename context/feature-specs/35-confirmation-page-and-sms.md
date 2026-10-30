# 35 · Confirmation Page and SMS

## Goal

Show the customer their booking and send the confirmation SMS.

## Depends On

- `33-booking-creation.md`
- `18-sms-adapter.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- `/booking/[token]`: looked up by `public_token` only. Crest, BOOKING CONFIRMED, the code large, service, staff (or "First available: Kwame"), date and time, "Pay at the studio", address, Call, Directions, "Show this code at the studio". Unknown tokens show a neutral not-found page. `noindex`.
- Send the confirmation SMS after the appointment is created, through `lib/sms`. Record `sms_status`. An SMS failure never fails the booking. No duplicate SMS on retry.

## Out Of Scope

- Reminder SMS (`later/`).

## Notes And Rules

- Keep the SMS short.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] The confirmation page shows the right booking and nothing else is reachable by guessing.
- [ ] The SMS arrives (or the failure is recorded and visible in the POS).

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
