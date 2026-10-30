# 24 · Offers Management

## Goal

The owner creates promotions shown on the website.

## Depends On

- `06-pos-services-and-categories.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- Offers list and form: title, description, image, optional linked service, start and end dates (date-only values, `starts_on` / `ends_on`, both optional), active.
- An offer is shown on the website only when it is active and today's date in Africa/Accra is on or after `starts_on` (when set) and on or before `ends_on` (when set). The end date is inclusive: an offer ending on the 30th shows all day on the 30th.

## Out Of Scope

- Automatic discounts at the counter (offers are display only in v1; the counter applies a price override with the reason "Offer" if needed, within the discount limit).

## Notes And Rules

- None.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Offers appear and disappear on the website according to their dates and active flag.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
