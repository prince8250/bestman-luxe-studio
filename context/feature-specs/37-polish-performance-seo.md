# 37 · Polish: Performance, SEO, Accessibility

## Goal

Make both systems fast, findable (website only), and accessible before launch.

## Depends On

- `36-pos-appointments.md`
- `29-site-offers-about-location-footer.md`

## Scope (Build Only This)

- Website: Lighthouse mobile pass on home, `/services`, `/gallery`, `/book`; image sizes; font loading; metadata, Open Graph image, `LocalBusiness` structured data (name, address, phone, hours from settings), sitemap (website only).
- POS: `noindex` everywhere, check slow pages with seeded data of about a year of sales.
- Accessibility: keyboard paths, focus states, contrast on photo overlays, form labels, reduced motion.
- Remove both design-check pages.

## Out Of Scope

- New features.

## Notes And Rules

- Report the measured numbers, not guesses.

## Screen Check

- Website parts at 375px and 1280px. POS parts at 1280px, 768px, and 375px.
- Loading, empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Website mobile Lighthouse performance and accessibility scores are reported, with fixes for anything poor.
- [ ] The POS dashboard and reports stay fast with a year of seeded sales.
- [ ] Design-check pages are gone.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
