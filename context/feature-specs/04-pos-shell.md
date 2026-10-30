# 04 · POS Shell, Permissions, and Find

## Goal

A protected POS area with the dashboard-style layout from the reference, where each role sees only what it may use, enforced on the server.

## Depends On

- `03-pos-login.md`

## Who Can Use This

- Owner and counter, each with their own navigation (see `ui-context.md` and the Permissions table).

## Scope (Build Only This)

- `lib/auth/permissions.ts`: the single map from action names to allowed roles, copied from the Permissions table in `architecture-context.md` (for example `sale.create`, `sale.reassignToday`, `sale.reassignAny`, `sale.editPaid`, `sale.void`, `sale.requestVoid`, `day.close`, `day.reopen`, `catalog.edit`, `reports.view`, `activity.view`, `backups.view`, `accounts.manage`, `customers.block`).
- `lib/auth/require-pos-user.ts`: `requirePosUser()` (active owner or counter) and `requirePermission(action)`, used by the POS layout, every POS page, and every POS server action. Returns the user's id, role, and display name.
- `app/pos/layout.tsx` enforces a POS user; anyone else goes to `/pos/login` and receives no POS data. Owner-only pages call `requirePermission` and show a plain "This page is for the owner" screen to counter users.
- Shell per `ui-context.md` ("Mapping The Reference" and "Role Home Pages"): white sidebar with the logo and **New sale** at the top; the owner's and the counter's navigation lists as specified; items a role cannot use are not rendered. Owner: backup status card placeholder. Counter: day status card placeholder.
- Top bar: **Find** box (receipt number, booking code, or phone; `Ctrl+K`; wired in specs 10, 13, 36), signed-in name and role, sign out.
- Responsive: sidebar on desktop, collapsible on tablet, bottom bar on phone (owner: Dashboard, Activity, Appointments, Sales, More; counter: New sale, Today, Appointments, Sales, More).
- Placeholder pages with the real route structure, including `/pos/today`, `/pos/activity`, and `/pos/close-day`.

## Out Of Scope

- The features inside each section.

## Notes And Rules

- Tests: a signed-out visitor cannot open any `/pos/*` page or call a POS server action; a counter user cannot open owner pages or call owner-only actions directly (call the action function, not just the page).
- Explain to the developer how this mirrors a Spring Security filter plus method-level `@PreAuthorize` checks.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Owner and counter each see only their navigation.
- [ ] A counter user is refused by the server on every owner-only page and action, even when calling them directly.
- [ ] `permissions.ts` matches the architecture Permissions table exactly.
- [ ] Navigation works at 1280px, 768px, and 375px; `Ctrl+K` focuses Find.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
