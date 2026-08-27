# Bliss — Wedding Planning App

A wedding planning companion for US couples that gives you one clear next step
at a time, and is built from the ground up for couples blending two traditions.

Monorepo: a Next.js web app and a Fastify API.

## What it does

- **14 quests** covering the full US planning arc, from budget and venue through
  the marriage license and the day-of run of show
- **Cultural tradition packs** — pick your heritages and Bliss adds the right
  events, vendors, attire, and lead times. Shipping South Asian, Chinese,
  Jewish, Korean, Nigerian, Mexican, Persian, Vietnamese, Filipino, and Greek
- **Wedding-type pruning** — an elopement gets 8 quests, not 14. A micro wedding
  drops guest logistics. The plan matches the wedding you're actually having
- **Lead-time aware** — deterministic dependencies, effort, and deadlines expose
  a plan that does not fit before the couple commits to it
- **Authority-bounded legal workflow** — informational, visibly disclaimed, and
  routed back to the issuing clerk or qualified counsel instead of model memory
- **Celebration moments** — milestone cards when a quest is complete
- **Shared AI planning threads** — both partners can express their own reasons;
  a disagreement stays contested instead of being flattened into one answer
- **Decision-grounded plans** — confirmed Decision Packets update tasks, attributed
  memory, drafts, and Moments without giving the model direct write access
- **Private Moment photos** — direct device uploads use single-use, wedding-scoped
  storage grants; the bucket stays private and reads receive short-lived URLs only
  after wedding membership is checked
- **Decision support across every base quest** — Attire and Photographer use
  specialized packs; the other 12 quests share guarded scoping tools while keeping
  their own authored choices, branch tasks, and release suites
- **Action Center** — exact-payload approval for reminders, calendar files, email
  drafts, provider-backed email sends, and vendor briefs; writes use durable leases,
  bounded retries, and stable provider idempotency
- **English-only ship, on a real i18n layer** — adding Spanish is a translation
  job, not a refactor

## Stack

| Layer | Tech |
|-------|------|
| API | Fastify + Bun + PostgreSQL + Drizzle ORM |
| Web | Next.js 14 (App Router) + Tailwind CSS + next-intl |
| i18n | Shared ICU catalogs in `packages/i18n` |
| Auth | Clerk |
| Deployment | API → Railway, Web → Vercel |

## Monorepo structure

```
apps/
  api/        Fastify REST API, quest generator, content templates
  web/        Next.js web app
packages/
  types/      Shared TypeScript types
  i18n/       Locale catalogs, content catalogs, formatters
  config/     Shared Tailwind and tsconfig
docs/         Market research, i18n guide, glossary, cultural traditions
```

## Getting started

```bash
bun install

# API
cp .env.example apps/api/.env        # DB, Clerk, model, vendor, and legal provider settings
cd apps/api && bun run db:migrate && bun run dev      # :3001

# Web
cp .env.example apps/web/.env.local  # NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL
cd apps/web && bun run dev                           # :3000
```

Moment photos need a private S3-compatible bucket (S3 or R2). Set the
`MEDIA_S3_*` variables in `.env.example`; give the credential only `GetObject`
and `PutObject` access to this bucket. Bucket CORS must allow `PUT` from
`WEB_URL` with the `Content-Type` and `If-None-Match` headers. Do not make the
bucket public.

## Verification

```bash
bun run test                 # 172 resolver, provider, scheduler, harness, pack, and release tests
bun run eval:agent           # 283-case release gate across all 14 base quests
bun run lint:i18n            # no CJK in code, no hardcoded JSX strings, catalog parity
bun run verify:generation    # generates 12 wedding variants, checks every row resolves
bun run type-check           # all workspaces
bun run build                # all workspaces
bun run smoke:agent          # temporary real-DB Attire flow; cleans up after itself
bun run smoke:photographer   # temporary real-DB search/shortlist/action flow; cleans up after itself
bun run smoke:scoping        # all 12 quests using the generic decision engine
bun run smoke:release        # sticky canary, rollback, and kill-switch DB verification
bun run smoke:couple         # owner-only invite and concurrent two-person join boundary
bun run smoke:model          # real configured model: two-turn tool-calling protocol check
bun run ops:agent --days=7   # bundle/model-segmented latency, cost, errors, and user feedback
```

`verify:generation` is the useful one when changing content. It prints the quest,
section, and task counts for each variant, so a template change shows up as a
diff instead of a surprise. Both it and `bun run test` run the content
self-check, which fails on a predicate that reads an answer key no scoping
question declares — the failure mode that would otherwise silently drop tasks
from every couple's list.

## Docs

| Doc | What it covers |
|---|---|
| [PRD.md](PRD.md) | The product: goal, thesis, advantage, scope, principles |
| [DESIGN.md](DESIGN.md) | How it is built: data model, resolver, scheduler, agent, API, sprints |
| [docs/AGENTIC-SYSTEM-DESIGN.md](docs/AGENTIC-SYSTEM-DESIGN.md) | Runtime, memory, tools, observability, eval, and release architecture |
| [docs/VOICE.md](docs/VOICE.md) | Companion voice, conflict guidance, and review rubric |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Production configuration, providers, workers, verification, and rollback |
| [docs/MARKET.md](docs/MARKET.md) | US market research: planning timeline, budget benchmarks, competitors |
| [docs/I18N.md](docs/I18N.md) | How to add a locale, key naming, what must never be translated |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | US wedding terminology used verbatim in UI copy |
| [docs/CULTURAL-TRADITIONS.md](docs/CULTURAL-TRADITIONS.md) | How cultural packs work, and how to add one |

Read PRD before DESIGN. `docs/other/` is personal reference material, not part of
the spec set.

## Conventions

- **Every file in this repo is written in English.** Code, comments, docs, UI
  copy, commit messages. CI enforces it. The one exception is `docs/other/`,
  which holds personal reference notes and is excluded from the check.
- **No hardcoded user-facing strings.** Everything goes through
  `packages/i18n`.
- **Enum values are identifiers, not display strings.** Translate the label,
  never the value.
- **Legal facts require fresh official-source provider data; lead times use
  authored deterministic data.** Neither comes from model memory.
