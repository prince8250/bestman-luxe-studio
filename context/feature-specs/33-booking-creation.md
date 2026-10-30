# 33 · Booking Creation

## Goal

Turn the confirmed form into a real appointment that reserves the slot.

## Depends On

- `32-booking-flow-ui.md`

## Scope (Build Only This)

- Public server action `createAppointment`: Zod validation; recompute eligibility, duration, and price on the server; re-check availability; call `create_appointment` (customer upsert + appointment with status `confirmed`, `source = web`, code, token, price snapshot).
- Refuse blocked numbers with a neutral message.
- Handle the overlap-constraint failure (slot just taken) with a friendly message and a return to slot selection.
- Redirect to `/booking/[token]` on success.

## Out Of Scope

- Turnstile and rate limits (spec 34, but structure the action so they slot in before any write). SMS and the confirmation page (spec 35).

## Notes And Rules

- Never trust client-supplied price, staff eligibility, or status.
- Test two simultaneous attempts on one slot: exactly one succeeds.

## Acceptance Criteria

- [ ] A booking creates exactly one confirmed appointment and one customer record per phone.
- [ ] Two racing bookings for one slot: one succeeds, one gets the friendly message.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
