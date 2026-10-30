# 03 · POS Login (Owner and Counter Accounts)

## Goal

Let the owner and the counter employee sign in to the POS securely. Nobody else has an account.

## Depends On

- `01-theme-fonts-and-tokens.md`
- `02-database-schema.md`

## Who Can Use This

- Owner and counter (sign-in). Nobody else.

## Scope (Build Only This)

- `/pos/login`: email and password with Supabase Auth, in the POS light style (logo, centered card).
- Session handling with `@supabase/ssr` and middleware/proxy refresh, so the counter PC stays signed in for a working day. Sign-out in the user menu.
- After sign-in, load the `profiles` row: an auth user with no profile, or with `active = false`, is signed out with a generic message.
- Write a `sign_in_events` row on every successful sign-in.
- Generic error on wrong credentials; repeated failures are slowed down.
- Owner lands on `/pos` (Dashboard); counter lands on `/pos/sale/new`.
- Document in the tracker how the **first owner** is created: create the user in the Supabase dashboard, then insert their `profiles` row with `role = 'owner'`. (Counter accounts are created by the owner in spec 07.) For local development, document creating one test owner and one test counter user.
- Optional "forgot password" through Supabase's reset email only if the developer asks.

## Out Of Scope

- The POS shell, role checks on pages, and permissions (spec 04). Creating counter accounts (spec 07).

## Notes And Rules

- There is no login link anywhere on the website.
- Confirm public sign-up is disabled in Supabase and record it in the tracker.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] The owner and a counter user can sign in and out.
- [ ] Wrong credentials give a generic error, and repeated attempts are slowed.
- [ ] A user without a profile, or with a deactivated profile, cannot get in.
- [ ] Every sign-in is recorded in `sign_in_events`.
- [ ] There is no sign-up path anywhere.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
