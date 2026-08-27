# Collaboration preferences

- Do not use any gstack skills by default.
- Use a gstack skill only when the user explicitly requests that specific skill.
- Keep responses concise and direct. Lead with the most practical solution, without explanatory preamble.
- **`docs/` is restricted.** Never read, search, list, cite, modify, or otherwise access any file under `docs/` unless the user explicitly grants permission for the current task. Do not infer permission from repository conventions, related requests, or earlier authorization.

# Repo conventions

- **Every file in this repo is written in English** — code, comments, docs, UI
  copy, content templates, commit messages. Conversation with the user happens
  in Chinese; files do not. `bun run lint:i18n` enforces this.
- Chinese is permitted in exactly two places: `docs/other/`, which is personal
  reference material rather than project spec, and `packages/i18n/src/locales/zh/`
  plus `content/zh/` if a `zh` locale is ever added.
- **`docs/other/` is out of scope.** Do not cite it, link to it from spec docs, or
  fold it into product or architecture reasoning unless explicitly asked.
- The spec set, in reading order: [README.md](README.md) →
  [PRD.md](PRD.md) (product) → [DESIGN.md](DESIGN.md) (implementation), with
  [docs/MARKET.md](docs/MARKET.md) as the source for every market number.
- **No hardcoded user-facing strings.** All copy goes through `packages/i18n`.
  See [docs/I18N.md](docs/I18N.md).
- **Enum values, slugs, and template keys are identifiers.** Translate labels,
  never values — they reach the database.
- **Legal facts and lead times come from lookup tables**
  (`apps/api/src/content/marriage-license.ts`), never from prose or model
  knowledge. A wrong waiting period can make a wedding legally impossible.
- After changing quest content or culture packs, run `bun run verify:generation`.

## Imported Claude Cowork project instructions
