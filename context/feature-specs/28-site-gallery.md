# 28 · Website Gallery Mosaic and Page

## Goal

The black-gutter photo mosaic on the home page and the full gallery with a viewer.

## Depends On

- `27-site-services.md`
- `23-pos-gallery.md`

## Who Can Use This

- Public website visitors. No login of any kind.

## Scope (Build Only This)

- Home: a mosaic of the latest active images (mostly tall tiles, since the studio's photos are portrait) with See More.
- `/gallery`: the full mosaic and a full-screen viewer (swipe on touch, arrows and Esc on desktop, clear close button).
- Staggered reveal animation.

## Out Of Scope

- Video.

## Notes And Rules

- `next/image` with correct sizes; lazy below the fold.

## Screen Check

- Website: verify at 375px first, then 1280px (also glance at 360px and 768px).
- Tap targets at least 44px, body text and inputs at least 16px.
- Loading, empty, and error states exist where data is fetched. Reduced motion respected.

## Acceptance Criteria

- [ ] Mosaic looks intentional at 375px and 1280px with real portrait photos.
- [ ] The viewer works by swipe, keyboard, and screen reader.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
