# 05 · Staff Management

## Goal

The owner adds, edits, and removes staff. Staff are records the counter assigns to jobs; they never log in.

## Depends On

- `04-pos-shell.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- Staff list (cards with photo, name, title, active state) and add/edit form: name, title, phone (optional, internal only), bio (optional), photo (resized and compressed in the browser before upload to `staff`), `show_on_website`, `bookable_online`, sort order.
- **Remove** = archive: sets `active = false` and `archived_at`, hides them from New sale and booking, keeps every past sale and report. A staff member with no history at all may be hard-deleted, after a confirm dialog.
- Restore an archived staff member.
- Zod validation, loading, saved, and error states.

## Out Of Scope

- Working hours and time off (spec 30). Assigning staff to services (spec 06).

## Notes And Rules

- The UI word is "Remove" because that is what the owner thinks; explain in the dialog that history is kept.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] The owner can add, edit, remove (archive), and restore staff.
- [ ] Archived staff disappear from pickers but stay in old sales and reports.
- [ ] Photos are compressed before upload; the database stores only the path.
- [ ] Staff phone numbers never appear in any public view.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
