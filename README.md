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
- **Lead-time aware** — gown alterations take 6-8 weeks and a marriage license
  waiting period is 3 days in 17 states, no matter how motivated you are
- **State-level legal guidance** — informational, with disclaimers, from a
  lookup table rather than from anyone's memory
- **Celebration moments** — milestone cards when a quest is complete
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
cp .env.example apps/api/.env        # DATABASE_URL, CLERK_SECRET_KEY
cd apps/api && bun run db:migrate && bun run dev      # :3001

# Web
cp .env.example apps/web/.env.local  # NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL
cd apps/web && bun run dev                           # :3000
```

## Verification

```bash
bun run lint:i18n            # no CJK in code, no hardcoded JSX strings, catalog parity
bun run verify:generation    # generates 9 wedding variants, checks every row resolves
bun run type-check           # all workspaces
bun run build                # all workspaces
```

`verify:generation` is the useful one when changing content. It prints the quest,
section, and task counts for each variant, so a template change shows up as a
diff instead of a surprise.

## Docs

| Doc | What it covers |
|---|---|
| [PRD.md](PRD.md) | The product: goal, thesis, advantage, scope, principles |
| [DESIGN.md](DESIGN.md) | How it is built: data model, resolver, scheduler, agent, API, sprints |
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
- **Legal and lead-time facts come from lookup tables**, never from prose.
