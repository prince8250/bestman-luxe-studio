# 32 · Website Booking Flow

## Goal

The `/book` steps: service, staff, time, name and phone, confirm.

## Depends On

- `27-site-services.md`
- `31-availability-engine.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- `/book` stepper as in `ui-context.md`: Service → Staff (with "No preference") → Date and time → Your details (name and phone only) → Confirm.
- Preselect from `?service=<id>`. Only `bookable_online` services and staff.
- Slots as square chips grouped Morning / Afternoon / Evening, from the availability engine.
- Phone field: numeric keyboard, normalized and validated with friendly errors.
- Sticky summary bar: selection, price, "Pay at the studio", main button.
- Progress kept in the URL so a refresh loses nothing.

## Out Of Scope

- Creating the appointment, Turnstile, SMS.

## Notes And Rules

- One decision per screen on mobile. If no slots exist, say so kindly and show a Call button.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] The whole flow works one-handed at 375px.
- [ ] Refresh keeps progress.
- [ ] No slots shows the helpful message.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
