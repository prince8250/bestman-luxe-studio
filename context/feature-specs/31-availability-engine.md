# 31 · Availability Engine

## Goal

Compute bookable online slots, as described in `architecture-context.md` "Online Availability Model".

## Depends On

- `30-staff-hours-and-time-off.md`
- `08-new-sale.md`

## Scope (Build Only This)

- `lib/availability`: pure functions that, given a service, optional staff, date range, working hours, time off, confirmed appointments, walk-in busy blocks, lead time (default 60 min), slot interval (default 30 min), and an explicit `now` (a UTC instant passed in by the caller), return slots with the staff who can take each one. The functions never read the process clock; past-slot and lead-time checks use the given `now`, and weekdays, working hours, and dates are computed in `Africa/Accra` through the shared time helper.
- "No preference" returns slots with the first free eligible staff member.
- A server function that fetches the data and calls the pure logic.
- Unit tests: back-to-back appointments, a service longer than a gap, time off, day off, past slots, lead time, a walk-in sale blocking a staff member, and "no preference".

## Out Of Scope

- Any UI.

## Notes And Rules

- The database overlap constraint stays the final guard; creation (spec 33) must handle a lost race.

## Acceptance Criteria

- [ ] All tests pass.
- [ ] A walk-in sale with Kofi at 14:00 for a 45-minute service removes Kofi's 14:00 and 14:30 slots online.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
