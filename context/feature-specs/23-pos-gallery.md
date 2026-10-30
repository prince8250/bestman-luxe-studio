# 23 · Gallery Management

## Goal

The owner adds, orders, and removes gallery pictures shown on the website.

## Depends On

- `04-pos-shell.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- Upload one or many images with browser-side resize and compression (long edge about 1600px, WebP or JPEG about 80% quality), progress, and errors.
- Edit caption (also used as `alt` text), reorder (drag on desktop, up/down buttons on touch), show or hide, delete (removes the storage file and the row, after confirm).
- Optional: import the starter photos from `context/studio-assets/photos/` through a one-off script, if the developer agrees.

## Out Of Scope

- Video, albums, categories.

## Notes And Rules

- Validate type and size on the client and the server. Store only paths.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Several phone photos upload, compressed, with progress.
- [ ] Order and visibility changes show on the website.
- [ ] Delete removes both the file and the row.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
