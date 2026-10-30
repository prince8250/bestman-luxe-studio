# 30 · Staff Working Hours and Time Off

## Goal

Tell the system when each staff member works, so the website only offers real slots.

## Depends On

- `05-pos-staff.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- Weekly hours editor per staff member (day off, and a split day if simple), with a "copy to all days" helper.
- Time off: add and remove days or ranges.
- Day view: pick a date and see each staff member's appointments and walk-in sale blocks for that day.
- All times in `Africa/Accra`.

## Out Of Scope

- The availability calculation (spec 31).

## Notes And Rules

- Warn when new hours or time off clash with existing confirmed appointments. Never silently cancel anything.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Hours and time off save and display correctly.
- [ ] Clashes with appointments are warned about, not auto-cancelled.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
