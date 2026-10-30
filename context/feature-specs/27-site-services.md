# 27 · Website Services Panels and Services Page

## Goal

Show the service categories as photo panels on the home page, and the full menu with prices on `/services`.

## Depends On

- `26-site-hero.md`
- `06-pos-services-and-categories.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- Home: category panels as in `ui-context.md` (staggered pair on desktop, stacked on mobile), each with See More linking to `/services#category`.
- `/services`: every active category and its services with `show_on_website`: photo, name, duration, price, and Book (to `/book?service=<id>`) for services that are `bookable_online`, otherwise "Walk in or call".
- Data from the public views only, cached and revalidated (on demand, from the saving server action) whenever the owner saves, archives, restores, or reorders a service **or a category**, so `/` and `/services` never wait on a time-based expiry to show catalog changes.

## Out Of Scope

- The booking flow itself.

## Notes And Rules

- A price changed in the POS appears on the website within a minute.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] Panels and the services page match the reference feel at 375px and 1280px.
- [ ] Archived or hidden services never appear.
- [ ] Prices match the POS.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
