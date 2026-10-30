# 25 · Website Navbar

## Goal

The floating navigation bar with Book always reachable.

## Depends On

- `01-theme-fonts-and-tokens.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- Floating centered bar as in `ui-context.md`, Bebas Neue links (Services, Gallery, About, Contact) that scroll to home sections, active section underline, and **Book** at the right (top right on mobile).
- Mobile: logo left, Book right, a menu button opening a full-screen sheet with the links, Call, and Directions.
- Becomes slightly more opaque after scrolling.

## Out Of Scope

- Hero and sections.

## Notes And Rules

- No login or POS link of any kind.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] Book is visible and tappable at all times at 375px and 1280px.
- [ ] Links scroll to the right sections; the active one is underlined.
- [ ] The mobile sheet is keyboard and screen-reader accessible.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
