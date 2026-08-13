# Collaboration preferences

- Do not use any gstack skills by default.
- Use a gstack skill only when the user explicitly requests that specific skill.
- Keep responses concise and direct. Lead with the most practical solution, without explanatory preamble.

# Repo conventions

- **Every file in this repo is written in English** — code, comments, docs, UI
  copy, content templates, commit messages. Conversation with the user happens
  in Chinese; files do not. `bun run lint:i18n` enforces this.
- The only Chinese permitted in the repo is inside
  `packages/i18n/src/locales/zh/` and `packages/i18n/src/content/zh/`, if a `zh`
  locale is ever added.
- **No hardcoded user-facing strings.** All copy goes through `packages/i18n`.
  See [docs/I18N.md](docs/I18N.md).
- **Enum values, slugs, and template keys are identifiers.** Translate labels,
  never values — they reach the database.
- **Legal facts and lead times come from lookup tables**
  (`apps/api/src/content/marriage-license.ts`), never from prose or model
  knowledge. A wrong waiting period can make a wedding legally impossible.
- After changing quest content or culture packs, run `bun run verify:generation`.
