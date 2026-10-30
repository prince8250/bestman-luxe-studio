# Development Workflow

## Approach

Build this project incrementally using a spec-driven workflow. The context files define what to build, how to build it, and the current state. The numbered files in `context/feature-specs/` define each unit of work. Always implement against these specs. Do not infer or invent behavior.

## Working With The Developer

The developer is a final-year computer science student who is strong in Java and Spring Boot, still learning systems design, weaker on frontend, and deliberately learning Next.js, TypeScript, and Supabase on this project. This is a real client project. So:

- **Explain as you go.** Explain what the code does and **why that decision was made** before the syntax. Plain language, short sentences. When you use jargon, add a one-line plain-English meaning.
- Spring Boot analogies help (a Postgres function is like a `@Transactional` service method; a server action is like a controller method the UI calls directly; RLS is like a security filter on every query).
- **Do not change direction silently.** If something must differ from the spec, say so and ask.
- **Be honest about what you verified.** Never say something works unless you ran it. If you could not test something (for example a real thermal printer, the Windows scheduled task, or a real SMS delivery), say so.
- **Push back when something is risky**, especially for money, security, or data loss, even if the developer asked for it.

## The Loop For Every Spec

The developer will say something like "Build `08-new-sale.md`". Then:

1. **Read.** Read the named spec and every spec under its "Depends on". Skim the context files if you have not in this session.
2. **Plan first.** Before writing code, reply with a short plan: what you will build, the files you will create or change, and any questions. Wait for the developer's go-ahead if the plan includes anything the spec does not cover or anything on the "Ask First" list.
3. **Build.** Implement only what the spec's Scope lists. Nothing from later specs.
4. **Verify.** Run `lint`, `typecheck`, `test` (once a test runner exists), and `build`. Fix failures. Check the feature at the widths the spec lists (website: 375px and 1280px; POS: 1280px, 768px, and 375px). Walk through the spec's Acceptance Criteria one by one.
5. **Explain.** Use this format:
   - **What I built**: two or three sentences.
   - **Files**: each file touched, with one line on what it does and why it exists.
   - **How it works**: the key idea in plain words, with a short analogy to Spring Boot or backend concepts when it helps.
   - **Decisions**: any choice you made and why.
   - **Checked**: what you ran and the results, plus anything you could not verify.
   - **How to try it**: exact steps for the developer to test it by hand.
6. **Update the tracker.** Update `context/progress-tracker.md` (completed work, current goal, open questions, session notes).
7. **Stop.** Do not start the next spec. Suggest a commit message.

## Scoping Rules

- Work on one spec at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in one step.
- If a change cannot be verified end to end quickly, the scope is too broad. Split it and say so.

## When To Split Work

Split an implementation step if it combines:

- UI work and database schema work
- Payment logic and unrelated UI
- Multiple unrelated server actions or routes
- Behavior that is not clearly defined in the context files or the spec

## Handling Missing Requirements

- Do not invent product behavior that is not defined in the context files.
- If a requirement is ambiguous, ask the developer, then record the answer in the relevant context file before implementing.
- If it can wait, add it as an open question in `progress-tracker.md` and continue with the parts that are clear.

## Ask First

Always ask before:

- Adding a new dependency.
- Changing the database schema or any migration that has already been applied.
- Changing anything in `context/` other than `progress-tracker.md`.
- Anything that touches money, sales, payments, staff attribution, authentication, or backups beyond what the spec describes.
- Deleting files or data.
- Changing the design tokens, fonts, or colors.

## Never

- Never edit generated shadcn/ui components in `components/ui/` or third-party library internals. Compose them in app-level components instead.
- Never put secrets in code, commits, or client-side bundles.
- Never use the service-role Supabase client outside server-only modules.
- Never trust prices, totals, staff eligibility, or status sent from the browser. Recompute on the server.
- Never count anything as revenue except paid, non-voided sales.
- Never delete a sale, a sale item, or an `audit_log` row. Never hard-delete staff or services that have history.
- Never chain multiple supabase-js writes for one logical operation. Use a Postgres function.
- Never point a restore, import, or test script at the production database.
- Never skip RLS on a new table.
- Never leave placeholder or fake data wired into production paths without labeling it clearly and logging it in the tracker.
- Never mark a spec complete if any acceptance criterion is unmet.

## Verification Commands

Use the scripts in `package.json`. At minimum, a spec is not done until these pass:

- `npm run lint`
- `npm run typecheck`
- `npm run test` (the runner exists from spec 00)
- `npm run build`

If a script is missing, add it as part of `00-project-setup.md` and note it in the tracker.

## Screen Check

For website UI, state how you checked it at 375px and 1280px. For POS UI, at 1280px, 768px, and 375px. Say what you could not check (for example a real phone, or a real thermal printer).

## Keeping Docs In Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries
- Data model or storage decisions
- Code conventions or standards
- Feature scope

Progress state must reflect the actual state of the implementation, not the intended state.

## Before Moving To The Next Spec

1. The current spec works end to end within its scope.
2. Every acceptance criterion is met or explicitly listed as unmet in the tracker.
3. No invariant in `architecture-context.md` was violated.
4. Lint, typecheck, and build pass.
5. `progress-tracker.md` reflects the completed work.
