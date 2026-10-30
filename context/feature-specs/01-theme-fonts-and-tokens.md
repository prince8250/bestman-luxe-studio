# 01 · Two Themes, Fonts, and Brand Wrappers

## Goal

Set up the website's dark theme and the POS's light theme, the Bebas Neue + Inter fonts, and the small styled wrapper components each system uses.

## Depends On

- `00-project-setup.md`

## Scope (Build Only This)

- Read `ui-context.md` fully and view every image in `design-reference/`.
- Load **Bebas Neue** (400) and **Inter** (variable) with `next/font/google`, exposed as `--font-display` and `--font-text`.
- Define the `--site-*` and `--pos-*` tokens in `globals.css`, each under its own scope (`.site` / `.pos` or `data-theme`), mapped with `@theme inline` so Tailwind classes like `bg-site-bg` and `bg-pos-surface` exist.
- `app/(site)/layout.tsx` applies the site theme (black background, `theme-color` `#000000`). `app/pos/layout.tsx` applies the POS theme and `robots: noindex`.
- Website wrappers in `components/brand-site/`: `SiteButton` (solid, outline; `asChild` for links), `SiteHeading` (Bebas Neue), `PaperSection` (off-white with a very light CSS or inline-SVG speckle), `Container`.
- POS wrappers in `components/brand-pos/`: `PosButton` (primary accent, secondary, ghost, danger), `PosCard` (16px radius, hairline border, title slot in Bebas Neue), `KpiTile` (label, big Bebas Neue value, change pill green or red), `PageHeader` (title + actions).
- A scroll-reveal helper for the website (Intersection Observer, opacity and transform only, once, off under `prefers-reduced-motion`).
- Temporary `/design-check` (website theme) and `/pos/design-check` (POS theme) pages showing every wrapper, swatch, and type size.

## Out Of Scope

- Navbar, sidebar, or any real page content.

## Notes And Rules

- Do not edit `components/ui/`.
- Bebas Neue: never below about 18px, never with `font-bold` or `uppercase`. Inter does all body text, tables, and inputs.
- Remove both design-check pages in spec 37.

## Screen Check

- Website parts at 375px and 1280px. POS parts at 1280px, 768px, and 375px.
- Loading, empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Both design-check pages match `ui-context.md` and the reference images in feel.
- [ ] No hex values or raw palette classes in components; tokens only.
- [ ] Website wrappers are square; POS cards are 16px rounded with hairline borders.
- [ ] Fonts load with no layout shift and fall back sensibly.
- [ ] Reduced-motion turns the reveal into a plain fade.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
