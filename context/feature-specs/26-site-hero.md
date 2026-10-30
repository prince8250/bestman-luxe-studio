# 26 · Website Hero

## Goal

The first screen: logo, studio name, Book Now, Call, and Directions, with the load animation.

## Depends On

- `25-site-navbar.md`
- `07-pos-studio-settings.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- Full-bleed dark hero with one of the studio photos (or the interior) under a dark overlay; logo crest; **BESTMAN LUXE STUDIO** in very large Bebas Neue; Book Now; Call and Directions as secondary actions visible without scrolling on a phone; social rail on desktop.
- Phone and map link come from `studio_settings`.
- The hero load animation from `ui-context.md`.

## Out Of Scope

- Other sections.

## Notes And Rules

- The hero image is preloaded and sized for mobile first; it must not block Book from appearing.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] Book, Call, and Directions are visible without scrolling at 360px.
- [ ] Largest Contentful Paint is at most 2.5 s for `/` in a production build, measured with Lighthouse (Chrome DevTools) in mobile mode with the default "Slow 4G" network and 4x CPU throttling, cache disabled (cold load); report the number.
- [ ] Reduced motion shows a simple fade.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
