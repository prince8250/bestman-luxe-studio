# 29 · Website Offers, About, Location, and Footer

## Goal

The rest of the home page.

## Depends On

- `28-site-gallery.md`
- `24-pos-offers.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- Offers strip (only when an offer is active).
- About on the paper background: interior photo, heading, the about text from settings, a button to `/book`.
- Location and contact: address, opening hours, big Call button, Directions, map link, WhatsApp link (all from settings).
- Footer: logo, quick links, socials, copyright.

## Out Of Scope

- None beyond the above.

## Notes And Rules

- No embedded map iframe on mobile by default (heavy); a static link or tap-to-load map is fine.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] Every detail comes from `studio_settings`.
- [ ] The page reads well top to bottom at 375px and 1280px.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
