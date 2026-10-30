# 06 · Services, Categories, and Prices

## Goal

The owner manages the service menu: categories, services, prices, durations, and which staff do which service.

## Depends On

- `05-pos-staff.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- Categories: name, tagline, image, sort order, active. (These drive the website panels and the New sale tabs.)
- Services: category, name, description, image, price (typed in GHS, stored as pesewas), duration in minutes, `show_on_website`, `bookable_online`, active, sort order.
- Assign staff to each service (multi-select of active staff) via `service_staff`.
- **Quick price edit**: a compact table view of all services with an inline price field, for changing many prices at once. Each price change writes an `audit_log` row (`service_price_changed`, old and new price).
- Remove = archive (history kept); hard delete only when never sold or booked.

## Out Of Scope

- Offers (spec 24). Online booking (later specs).

## Notes And Rules

- Changing a price never changes past sales (snapshot rule). Say so on the price field.
- Compress and resize images before upload.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] The owner can add, edit, reorder, archive categories and services.
- [ ] Price changes are logged with old and new values.
- [ ] Staff assignment saves correctly and shows on the service.
- [ ] Archived services disappear from New sale and the website but stay in history.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
