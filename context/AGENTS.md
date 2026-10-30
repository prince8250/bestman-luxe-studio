<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Application Building Context

This project is **two systems in one codebase** for **Bestman Luxe Studio**, a barbering and beauty studio in Kumasi, Ghana:

1. **The POS** (`app/pos`) — the main product. The studio's counter system: record walk-in sales, print receipts, track which staff member did which job, manage services, prices, staff, gallery and offers, see dashboards and reports, receive online bookings, and keep backups. **Two POS roles: the owner and the counter employee. Staff never log in.**
2. **The public website** (`app/(site)`) — a showcase. No login of any kind. Visitors see services, the gallery, the location, and can book an appointment with only a name and phone number. The booking appears in the POS.

**The POS is the priority.** When the two systems compete for time or attention, the POS wins.

Read these files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — what is being built, for whom, and the scope
2. `context/architecture-context.md` — stack, data model, money rules, invariants
3. `context/backup-and-recovery.md` — daily PC backups, weekly cloud backups, restore drills
4. `context/ui-context.md` — two design systems (dark editorial website, light dashboard POS), fonts, motion. **View the images in `context/design-reference/` before any UI work.**
5. `context/code-standards.md` — implementation rules and conventions
6. `context/ai-workflow-rules.md` — how to work with the developer and explain your work
7. `context/progress-tracker.md` — current phase, completed work, open questions, next steps

Real studio photos and the logo are in `context/studio-assets/`. See its README before using them.

## Building Features

Features are built one at a time from the numbered specs in `context/feature-specs/` (`00-...md`, `01-...md`, and so on). Specs in `context/feature-specs/later/` are **not** part of version 1. Never build them unless the developer explicitly says so.

- Build only the spec the developer names. Never start the next spec on your own.
- Read the named spec fully, plus every spec it lists under "Depends on", before writing code.
- Follow the workflow in `context/ai-workflow-rules.md`: plan first, build, explain, verify, update the tracker.

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing (after asking the developer, see "Ask First").
