# 08 · New Sale (the Counter Screen)

## Goal

The most important screen in the project: record a walk-in's services, the staff who will do each one, and the payment, in under 30 seconds.

## Depends On

- `06-pos-services-and-categories.md`
- `07-pos-studio-settings.md`

## Who Can Use This

- Owner and counter. For counter users the discount limit and the backdate limit from Settings apply, enforced on the server.

## Scope (Build Only This)

- `/pos/sale/new`, laid out as in `ui-context.md` "The New Sale Screen": service tiles by category with search on the left, the ticket on the right.
- Add one or more lines. Each line: service, **staff member** (photo chips; staff assigned to the service first, then "Other staff"), price (defaults to the service price; changing it opens a dialog that requires a reason), quantity (default 1).
- **Price override limits by role**: a counter user may discount up to `max_counter_discount_percent` below the service price (the dialog says "Bigger discounts need the owner") and may raise a price with a reason; the owner has no limit. Enforced again in `create_sale`. An override above `override_alert_threshold` creates an `owner_alerts` row (sent in spec 19).
- **Custom item** line: free-text name and price, optional staff (for an occasional product or extra).
- Customer: optional phone field with live lookup. Found: show name and number of past visits and reuse the record. Not found: optional name field; the record is created on save. Blocked numbers show a warning but are still allowed to buy at the counter.
- Payment: Cash, MoMo, Card, or Split (several methods adding up to the total). Cash shows tendered and change. MoMo and card accept an optional reference.
- **CONFIRM & PRINT** calls a server action that re-reads prices and staff from the database, validates everything with Zod, then calls `create_sale`, which records `created_by`. Never trust the browser's prices or totals.
- If the business day is already closed (spec 17), the sale is still allowed, flagged `after_close`, with a notice on screen.
- On success: open the receipt (spec 09) and reset the ticket. On failure: keep the ticket on screen with a clear message, so nothing typed is lost.
- Keyboard shortcuts from `ui-context.md`.
- The in-progress ticket survives an accidental page refresh (kept in `sessionStorage` under a key that includes the signed-in user's id, and stored together with that id; cleared after a successful sale). It is cleared on sign-out, and a ticket saved by a different account is discarded unread when another account signs in on the same PC, so one POS account can never see or submit another account's customer or sale data.

## Out Of Scope

- Receipt layout (spec 09). Starting a sale from an appointment (spec 36; but design the action so an `appointment_id` and prefilled lines are easy to pass in). Backdated sales (spec 12).

## Notes And Rules

- Paid means confirmed: there is no "unpaid" sale saved anywhere.
- The `after_close` flag and the closed-day check depend on `day_closes`, which exists from spec 02; the Close day screen itself is spec 17.
- A walk-in sale is never blocked by a staff member's schedule.
- Double-click protection: the confirm button disables while pending, and the action is idempotent (the client sends a random `client_request_id`; a second call with the same id returns the first sale instead of creating another).

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] A one-service cash sale takes under 30 seconds from opening the screen to the receipt.
- [ ] A sale with three lines done by two different staff saves correctly, each line with its own staff.
- [ ] Split payments must add up to the total before Confirm is enabled, and the server rejects anything else.
- [ ] A changed price without a reason cannot be saved.
- [ ] A counter discount above the limit is refused by the server, even if the browser is bypassed.
- [ ] A returning phone number is recognized; a new one creates a customer.
- [ ] Double-clicking Confirm creates exactly one sale.
- [ ] Works with mouse and keyboard at 1280px and by touch on a tablet.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
