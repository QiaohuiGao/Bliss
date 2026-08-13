# Bliss → US Market: Research & Localization Plan

**Status:** Implemented, except where noted below (see the status box after Part 1)
**Date:** 2026-08-12
**Goal:** Convert Bliss from a Chinese-language, China-market wedding quest planner into an
English-only product built for US couples, with first-class support for multicultural /
immigrant-family weddings. Every artifact in the repo (code, content, docs, seeds, UI copy)
must end up in English.

---

## Implementation status (updated 2026-08-13)

Phases 0, 1, 1b, 2, 3, 5, and 6 are implemented and verified on branch
`us-market-migration`. Verify with `bun run lint:i18n` and
`bun run verify:generation`.

**Phase 4 changed.** `apps/mobile` has been **deleted** rather than localized:
its screens targeted a data model that no longer exists, so a localization pass
would have been applied to code slated for rewrite. A native client, if it
returns, is a rebuild against the quest API. Every mobile reference below is
retained as a record of the original plan, not as pending work. The API half of
Phase 4 stands.

**Phase 0 open questions, resolved:** cultural packs ship in v1; USD is a hard
cut; the default locale is prefix-less; `es` is the intended second locale;
mobile is out of scope permanently.

**One item is not done and blocks launch.** `validityDays` and
`witnessesRequired` in `apps/api/src/content/marriage-license.ts` are national
defaults, not per-state sourced values. Waiting periods are sourced. See the
`verifyWithCounty` flag and the TODO in that file.

---

## Part 1 — Research Findings

### 1.1 How Americans actually plan a wedding

**Engagement → wedding is typically 12–18 months.** Popular venues and peak-season dates
(May–October, plus Saturday preference) are booked 12–18 months out. Shorter timelines
(6–9 months, "short engagement") are common and need a compressed task set.

Canonical booking order (this is the backbone of a US task graph):

| When | What happens |
|---|---|
| 12–18 mo | Set overall budget, draft guest count, pick venue + date, hire wedding planner, insurance |
| 9–12 mo | Photographer, videographer, caterer, band/DJ, officiant; engagement party; wedding website; save-the-dates; wedding dress ordered (6–9 mo lead time for alterations) |
| 6–8 mo | Florist, cake/baker, rentals, hair & makeup, transportation, hotel room blocks, registry, honeymoon + passports |
| 4–6 mo | Invitations ordered, menu tasting, ceremony music, suits/tuxes, bridal party attire, pre-marital counseling (if religious venue) |
| 2–3 mo | Invitations mailed (6–8 weeks before), **marriage license research**, day-of timeline draft, seating chart start, vows, bachelor/bachelorette, bridal shower |
| 1 mo | RSVP chase, final headcount to caterer, marriage license obtained, final dress fitting, seating chart + escort/place cards, final payments & vendor tips prepped |
| 1 week | Rehearsal + rehearsal dinner, pack emergency kit, deliver final counts, confirm all vendor arrival times |
| Day of / after | Ceremony, reception, send-off; then thank-you notes, name change, preserve dress, album |

**US-specific structural facts that differ from the current Chinese model:**

1. **Legal marriage is a separate, state-level task.** Marriage license is issued by a county
   clerk, expires (typically 30–90 days), and many states impose a waiting period (3 days:
   AK, FL, IN, IA, KS, LA, ME, MA, MI, MS, MO, NH, NJ, OR, PA, TN, WA; 48h: MD). Officiant
   rules vary — some jurisdictions (e.g. parts of NY) do not reliably accept online
   ordinations, which can invalidate a marriage. This deserves its own quest with a
   state-aware checklist.
2. **Post-wedding legal admin** — name change is *not* automatic from the license checkbox;
   it requires Social Security → driver's license → passport → banks, in that order.
3. **Multi-event structure, not one banquet:** engagement party, bridal shower, bachelor/ette,
   welcome party, rehearsal dinner, wedding day, day-after brunch.
4. **Registry + wedding website are core**, not optional (Zola/The Knot/Amazon registries;
   wedding website carries RSVP, travel, dress code, registry links).
5. **Guest logistics are heavier:** hotel room blocks, shuttles, out-of-town welcome bags,
   plus-one policy, kids policy, dietary/allergy tracking, RSVP with meal choice.
6. **Tipping and vendor gratuity** is an expected budget line item (US-specific).
7. **Weather/backup plan** and **wedding insurance / liability certificate** (many venues
   require a COI) are standard.
8. **No 黄历 / auspicious-date logic.** Replace with: season, venue availability, holiday
   weekends, guest travel, off-peak pricing (Friday/Sunday/winter discounts).

### 1.2 Budget benchmarks (for defaults and copy)

The Knot 2026 Real Weddings Study: **average US wedding ≈ $34,200**, average **117 guests**,
≈ **$290–300 per guest**. Venue averages ≈ **$12,900**; catering ≈ **$85/person**;
photography ≈ **$3,800**; florals ≈ **$2,900**; DJ ≈ **$1,700**, live band ≈ **$4,200**.

Planner-standard allocation (use as the app's default budget model):

| Category | % of budget |
|---|---|
| Venue + catering (incl. bar) | 40–50% |
| Photography + videography | 10–12% |
| Flowers + decor | 8–10% |
| Attire + beauty | 5–9% |
| Music / entertainment | 5–10% |
| Rings | ~4% |
| Stationery (STDs, invites, signage) | 2–3% |
| Transportation | ~2% |
| Favors / gifts | ~2% |
| **Buffer + tips** | **5–10%** |

Budget tiers to replace the current RMB tiers (¥50k/150k/300k):
`Under $20k` · `$20k–$40k` · `$40k–$75k` · `$75k+`, plus an explicit
"regional cost varies" note (NYC/CA/NJ high, Midwest/South lower).

### 1.3 Terminology glossary (must be used verbatim in UI copy)

**Planning roles:** wedding planner (full-service) · partial planner · **day-of coordinator**
(final-weeks logistics + day execution) · venue coordinator (works for the venue, not you) ·
officiant · vendor · point person.

**Stationery & paper:** **save-the-date** · invitation suite · RSVP card · response deadline ·
**escort card** (directs a guest to a *table*) vs **place card** (a specific *seat*) · menu
card · programs · signage · thank-you notes · calligraphy · inner/outer envelope · A7/A1
envelope sizes · "and Guest" (plus-one).

**Events:** engagement party · **bridal shower** · bachelor / bachelorette party ·
welcome party · **rehearsal** and **rehearsal dinner** · **first look** · **cocktail hour** ·
**grand entrance** · first dance · parent dances · toasts/speeches · cake cutting ·
bouquet toss · **last dance / send-off** · **after-party** · farewell brunch.

**People:** wedding party (maid/matron of honor, best man, bridesmaids, groomsmen,
attendants, flower girl, ring bearer, ushers, junior bridesmaid) · **VIPs** ·
processional order · **something old/new/borrowed/blue**.

**Contracts & money:** retainer/deposit (usually non-refundable) · **COI** (certificate of
insurance) · **force majeure** clause · service charge vs **gratuity** · corkage fee ·
cake-cutting fee · **plated / buffet / family-style / stations** service · **open bar / limited
bar / cash bar / consumption vs per-person bar** · **BYOB venue** · **all-inclusive venue** ·
**minimum spend / food-and-beverage minimum** · vendor meal · **overtime rate** ·
site fee · setup/strike (load-in/load-out) · **final headcount** deadline.

**Design & rentals:** **tablescape** · centerpiece · charger · linens · chiavari chair ·
**installation** · arch/arbor/**chuppah** · **ceremony backdrop** · draping · uplighting ·
**string / bistro lights** · **tenting** · lounge furniture · **floor plan** · **seating chart** ·
head table vs **sweetheart table** · **welcome/gift table** · **guest book** ·
**escort display** · **flat lay** · **golden hour** · **getting-ready suite** ·
**shot list** · **day-of timeline / run of show**.

**Attire:** silhouette (A-line, ball gown, mermaid/trumpet, sheath) · **alterations** ·
**bustle** · veil lengths (birdcage/fingertip/cathedral) · **black tie / black tie optional /
cocktail / semi-formal / dressy casual / garden party** dress codes · tux vs suit ·
boutonnière · corsage.

**Types of wedding:** **elopement** · **micro wedding** (≤50) · **destination wedding** ·
**courthouse / civil ceremony** · **backyard wedding** · **all-inclusive resort wedding** ·
**second-line** · **content creator** (new 2025–26 vendor category) · **unplugged ceremony**.

### 1.4 Immigrant / multicultural wedding customs (differentiator)

The US wedding market is heavily multicultural; ~1 in 4 couples blends two traditions.
Bliss should ship a **Cultural Traditions** layer: the couple selects one or more heritages,
and the app injects the correct extra events, vendors, attire, and lead times.

| Heritage | Rituals / events to model | Planning implications |
|---|---|---|
| South Asian (Indian/Pakistani/Bangladeshi/Sri Lankan) | **Mehndi/Mehendi**, **Sangeet**, Haldi/Pithi, **Baraat**, **Mandap**, **Saptapadi**, Jaimala, Vidaai, Nikah/Walima, Reception | Multi-day (2–4 events), 300–500 guests, South Asian caterer, dhol/DJ, mandap decor, priest/pandit or imam, guest attire guidance |
| Chinese | **Tea ceremony (敬茶)**, door games (闯门), hair-combing, **qipao/cheongsam** + gown changes, 10-course banquet, **red envelopes (hongbao)**, roast pig / gift exchange, double-happiness decor | Banquet venue with Chinese kitchen, lucky date/number preferences, two-family gift etiquette, bilingual MC |
| Jewish | **Ketubah** signing, **chuppah**, bedeken, **circling**, **sheva brachot**, breaking the glass, **hora / chair dance**, yichud, aufruf | Rabbi/cantor availability (no Shabbat/holiday dates), kosher or kosher-style catering, ketubah artist lead time, klezmer/band |
| Korean | **Paebaek**, hanbok rental, jeonan-rye, sang (ceremonial table), noribae | Hanbok rental + dresser, paebaek room at venue, family-bow choreography |
| Nigerian / West African | **Traditional engagement (Igbo Igba Nkwu / Yoruba Engagement)**, aso-ebi coordinated fabric, **money spray**, gele tying, live Afrobeat band/DJ | Two weddings (traditional + white), aso-ebi fabric sourcing months out, spray-money etiquette, MC/alaga ijoko |
| Mexican / Latin American | Catholic **misa**, **lazo**, **padrinos/madrinas**, **arras** (13 coins), **mariachi**, **la hora loca**, **el baile del dólar**, **vals** | Church pre-cana requirements, padrino sponsorship = distributed budget, late-night second meal |
| Persian / Iranian | **Sofreh Aghd** (mirror, candles, sweets, poetry book), **knife dance**, honey ritual, aghd + jashn | Sofreh designer, aghd officiant, large guest lists, dinner starts late |
| Filipino, Vietnamese, Ethiopian, Greek, Italian, Polish, Hmong, Armenian, Arab | Cord & veil / candle sponsors; **Lễ Gia Tiên** ancestral altar + áo dài; **telosh / melse**; **koufeta**, stefana, money dance; **oczepiny**; henna/**zaffa** | Same pattern: ancestral/family ceremony + Western ceremony + banquet |

**Cross-cutting immigrant-family needs to build for:**

- **Interfaith / two-officiant ceremonies**, ceremony script blending, ritual order negotiation.
- **Bilingual** invitations, signage, program, and MC; translation tasks.
- **International guests:** visa invitation letters, passport validity, hotel blocks, airport
  logistics, long RSVP lead time (send STDs 9–12 months out for overseas guests).
- **Documents:** foreign birth certificates/divorce decrees need **certified English
  translation** for the marriage license; single-status affidavits for some consulates.
- **Immigration adjacency (informational only, not legal advice):** couples marrying on a
  K-1 fiancé(e) visa have a **90-day** window; others plan around adjustment of status or
  a separate ceremony abroad. Surface as a checklist + "consult an attorney" disclaimer.
- **Family politics:** who pays what (US "bride's family pays" is largely obsolete; many
  immigrant families expect groom's family or padrinos to fund specific items), guest-list
  pressure from parents, elder seating and honors.

---

## Part 2 — Codebase Gap Analysis

Chinese-language / China-market assumptions live in exactly these places:

| File | Issue |
|---|---|
| `apps/api/src/content/quest-templates.ts` (313 CJK lines, 719 total) | Entire quest/task tree is Chinese and China-specific (黄历 auspicious dates, 敬酒服, 出门纱, no marriage license / registry / room blocks / rehearsal dinner) |
| `apps/web/app/onboarding/page.tsx` (36) | Chinese step copy; style options (中式/西式); guest tiers; **budget tiers in RMB cents** |
| `apps/web/app/board/page.tsx` (15), `app/quest/[moduleId]/page.tsx` (10), `app/dashboard/page.tsx` (16), `components/shared/NavBar.tsx` (2) | Hardcoded Chinese UI strings |
| `apps/web/lib/utils.ts` (6) | `formatCents` hardcodes `zh-CN` / `CNY`; `daysUntilText` returns Chinese |
| `apps/web/app/layout.tsx` | `<html lang>`, metadata, font stack (needs a Latin-first pairing) |
| `packages/types/src/index.ts` | `GuestCountRange` tiers fit China (`under_50 … over_200`) but no `cultures`, `state`, `eventType` fields |
| `apps/api/src/db/schema/weddings.ts` | Missing: `state`/`region`, `cultures[]`, `wedding_type` (elopement/micro/destination), `currency`; budget stored as cents (fine — reuse for USD) |
| `apps/mobile/*` | Mirrors web screens; same copy debt |
| `PRD.md`, `DESIGN.md`, `AGENTS.md`, `README.md` | Chinese product docs |

There is **no i18n framework to unwind** — all copy is inline. That is the real gap: shipping
English as flat inline strings would just recreate the same debt in a different language. So the
localization pass doubles as **introducing the i18n layer**, with `en` as the only shipped
locale and `es` / `zh` / future locales as drop-in catalogs. See Part 2b.

---

## Part 2b — i18n Architecture (ship `en` only, built for `es` / `zh` / N locales)

### Stack

| Surface | Library | Why |
|---|---|---|
| `apps/web` (Next.js App Router) | **`next-intl`** | Purpose-built for App Router: works in Server Components (no client bundle for server copy), locale-segment routing, native **ICU MessageFormat** (plural/select/gender — mandatory for Spanish and for "1 day"/"2 days"), typed message keys |
| `apps/mobile` (Expo) | **`i18next` + `react-i18next`** with `i18next-icu` | The RN-standard choice; `i18next-icu` makes it consume the *same* ICU catalogs as web. Locale from `expo-localization` |
| `apps/api` (Hono) | **`intl-messageformat`** directly | The API only needs a few strings (errors, activity feed). No framework; resolve locale from `Accept-Language` or an explicit `?locale=` |

Rejected: `react-intl` (weak App Router/RSC story), `lingui` (nice macros, extra build step),
raw `Intl` only (no plural/select — breaks on Spanish and Chinese counters).

### Shared catalogs — `packages/i18n`

```
packages/i18n/
  src/
    locales/
      en/  common.json  onboarding.json  board.json  quest.json  errors.json  glossary.json
      es/  … (same filenames, added later)
      zh/  …
    content/
      en/  quests.json          # quest / sub-module / task copy, keyed by template key
      es/  quests.json
    config.ts                   # SUPPORTED_LOCALES, DEFAULT_LOCALE, RTL list, currency+date opts
    index.ts                    # loadMessages(locale, ns), formatters
```

- **One source of truth** consumed by web, mobile, and API — no duplicated string tables.
- **ICU MessageFormat** everywhere: `"{days, plural, =0 {Today's the day!} one {# day to go} other {# days to go}}"`.
- Keys are **namespaced and semantic**: `onboarding.step.date.title`, not `step1Title`.
- `config.ts` centralizes locale metadata so adding `es` is: add the folder, add one entry, done.
- Fallback chain `es-MX → es → en`, with `en` as the guaranteed backstop.

### The hard part: **localizing DB-generated content**

Quest/module/task rows are generated *per wedding* from templates and then persisted, so their
text is frozen at generation time — naively translating later would require re-writing user data.
Decision:

- Template-derived rows store a **stable `i18nKey`** (e.g. `quest.legal.task.marriage_license`)
  alongside a rendered `title`. `i18nKey` is the source of truth for display; the stored `title`
  is only a fallback / search field.
- **User-authored** content (custom quests, notes, custom tasks) stays free text, rendered as-is,
  never translated. A `isCustom`/`i18nKey IS NULL` check distinguishes the two.
- Consequence for Phase 1: add `i18n_key text` to `modules`, `sub_modules`, `tasks`. Existing
  `templateKey` on `modules` is close but not granular enough (no sub-module/task keys).
- Cultural packs get their own key namespace: `culture.south_asian.quest.mehndi.*`.

### Formatting & non-string concerns

- **Currency:** keep integer cents. `Intl.NumberFormat(locale, { currency })` — currency is a
  *wedding* property (USD for the US market), independent of display locale, so a Spanish-speaking
  US couple sees `$34,200`, not `34.200 €`.
- **Dates / relative time:** `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat`, never hand-built
  strings. Watch week-start and month-name-first-vs-last ordering in the timeline UI.
- **Layout:** allow ~35% text expansion for Spanish (German later would need more); no
  fixed-width buttons, no text baked into images. Add `dir` handling now (cheap) so Arabic/Hebrew
  is possible later — relevant given the multicultural positioning.
- **Names:** don't assume given-name/family-name order or a middle name.
- **Fonts:** the Latin pairing must have a CJK fallback stack so `zh` doesn't render tofu.

### Guardrails (CI)

1. **No hardcoded user-facing strings** — lint rule (`eslint-plugin-formatjs` /
   `react/jsx-no-literals` scoped to `apps/web/app` + `components`) so English can't creep
   back inline.
2. **Catalog parity check** — script asserts every locale has the same key set as `en`
   (missing keys warn, extra keys fail).
3. Keep the CJK-character grep gate, but scoped to **code only**, excluding
   `packages/i18n/src/locales/zh/**`.

---

## Part 3 — Action Plan

### Phase 0 — Decisions to lock (before coding)

1. **Ship `en` only, but build on a real i18n layer** (Part 2b): `next-intl` on web,
   `i18next`+`i18next-icu` on mobile, shared ICU catalogs in `packages/i18n`. `es` and `zh`
   are then catalog-only additions, no refactor.
2. Locale is **separate from currency**: display locale is per-user, currency is per-wedding
   (USD for this market). Money stays **integer cents**.
3. Persisted template content is displayed via **`i18nKey`**, not the frozen `title` column;
   user-authored text is never translated.
4. Cultural traditions = **additive quest packs** keyed off a new `cultures[]` field, not a
   fork of the base template. Culture ≠ locale (a Chinese-American couple may want an English
   UI with the Chinese tradition pack).
5. Legal content is **informational with disclaimers**; no state-by-state legal guarantees.
6. Locale routing: `/[locale]/…` segments on web with `en` as default. Decide now whether `en`
   is prefix-less (`/board`) or prefixed (`/en/board`) — recommend **prefix-less default**
   to keep current URLs and SEO.

### Phase 1 — Data model & types

- `weddings`: add `state` (2-letter), `city`, `cultures text[]`, `weddingType` enum
  (`traditional | micro | elopement | destination | courthouse`), `currency` default `'USD'`,
  `guestCountExact` promoted to primary with range as fallback.
- `users`: add `locale text default 'en'` (+ optional `timeZone`) so the API can localize
  notifications and emails.
- `modules`, `sub_modules`, `tasks`: add `i18n_key text` (nullable ⇒ user-authored).
- `packages/types`: retier `GuestCountRange` → `under_50 | 50_100 | 100_150 | 150_250 | over_250`
  (matches US 117 average), add `Culture`, `WeddingType`, `BudgetTier`, `Locale` unions.
- New Drizzle migration; regenerate snapshot. Rename existing enum values via SQL.

### Phase 1b — Stand up `packages/i18n`

- New workspace package with the layout in Part 2b; `config.ts` exporting
  `SUPPORTED_LOCALES = ['en']` (typed so adding `'es'` propagates), `DEFAULT_LOCALE`, formatters.
- Wire `next-intl` into `apps/web` (middleware + `[locale]` segment + request config), merging
  with the existing Clerk middleware in [middleware.ts](apps/web/middleware.ts).
- Wire `i18next` + `expo-localization` into `apps/mobile`.
- Add `intl-messageformat` + `Accept-Language` resolution to `apps/api`.
- Add the two CI guardrail scripts (no-inline-strings lint, catalog parity).
- Smoke test: add a throwaway `es` catalog with 3 keys to prove the switch works end to end,
  then delete it (or keep it as a fixture for the parity test).

### Phase 2 — Rewrite the quest content (the biggest single task)

Replace `quest-templates.ts` with a **key-only structural template** —
`{ key, i18nKey, order, prerequisites, estimatedDays, cultures?, weddingTypes? }` — while all
human-readable copy moves to `packages/i18n/src/content/en/quests.json`. This is what makes a
Spanish or Chinese quest tree a pure translation job instead of a code fork.

Proposed 14 quests:

1. **Foundation** — budget, guest count draft, priorities, planner decision, wedding insurance
2. **Venue & Date** — tour checklist, F&B minimum, COI, rain plan, contract review
3. **Vendor Dream Team** — photographer, videographer, caterer, DJ/band, officiant, content creator
4. **Wedding Party & VIPs** — asks, roles, attire, gifts, duties
5. **Attire & Beauty** — gown timeline (order → 3 fittings → bustle), suits, hair & makeup trial
6. **Guest List & Stationery** — save-the-dates, wedding website, invitation suite, RSVP + meal choice
7. **Guest Experience & Travel** — hotel room blocks, shuttles, welcome bags, out-of-town guests
8. **Food & Beverage** — tasting, service style, bar package, dietary needs, vendor meals, cake
9. **Design, Flowers & Rentals** — mood board, florals, tablescape, lighting, rentals, signage
10. **Ceremony** — officiant, script, vows, readings, processional order, music, unity ritual
11. **Registry, Rings & Honeymoon** — registry, bands, passports, PTO, travel
12. **Legal & Paperwork** *(new, US-critical)* — marriage license (state rules + waiting period),
    officiant legitimacy, witnesses, certified copies, post-wedding name change
13. **Pre-Wedding Events** — engagement party, showers, bachelor/ette, welcome party, rehearsal dinner
14. **Final 30 Days & Day-Of** — final headcount, seating chart, run of show, tips envelopes,
    emergency kit, rehearsal, day-after brunch, thank-yous

Plus **cultural add-on packs** (`culturePacks.ts`), one per heritage in §1.4, each contributing
sub-modules and tasks that merge into the base tree at generation time. Also **conditional
pruning**: elopement/micro/destination/short-engagement variants drop or compress modules.

Task copy rules: use the §1.3 glossary verbatim; every task actionable in ≤1 sitting;
include lead-time hints ("book 9–12 months out"); dollar amounts from §1.2.

### Phase 3 — Web UI: extract to catalogs + rewrite in English

Every string moves to a catalog key in the same pass that rewrites it — no inline English.

- `lib/utils.ts`: `formatCents` → locale-aware `Intl.NumberFormat(locale, { currency })`;
  delete `daysUntilText` and replace with an ICU message
  (`board.countdown`: `{days, plural, =0 {Today's the day!} one {# day to go} other {# days to go}}`)
  plus a months variant — no string concatenation.
- `onboarding/page.tsx` → `onboarding.json`: all 6 steps; new style options
  (Classic, Modern, Rustic, Garden, Beach/Coastal, Boho, Black-tie, Destination, Backyard,
  Minimalist, Vintage); US guest tiers; **USD budget tiers**; add two new steps:
  **state/city** and **cultural traditions** multi-select (drives Phase 2 packs).
  Note: option `value`s stay stable English slugs (DB-facing); only labels are translated.
- `board`, `quest/[moduleId]`, `dashboard`, `NavBar` → `board.json` / `quest.json` /
  `common.json`; render template content via `i18nKey`.
- `layout.tsx`: move under `app/[locale]/`, `<html lang={locale}>`, localized metadata/OG,
  Latin-first font pairing per `DESIGN.md` with a CJK fallback stack.
- Sweep: `grep -rP '[\x{4e00}-\x{9fff}]'` returns zero hits under `apps/` and `packages`
  (excluding `locales/zh/**`), and the no-inline-strings lint passes.

### Phase 4 — API & mobile

- API: error messages, celebration/encouragement copy, and activity-feed strings become keys
  resolved against the shared catalog using the requester's locale (`users.locale` or
  `Accept-Language`); API returns **keys + params** wherever the client can render, and
  pre-rendered text only for push/email.
- Mobile: same extraction across `apps/mobile/app/*` (5 screens + onboarding) against the
  shared catalogs via `i18next-icu`.

### Phase 5 — Docs & repo hygiene

- Rewrite `PRD.md`, `DESIGN.md`, `README.md`, `AGENTS.md` in English; PRD gains a
  US-market section (ICP, competitors: The Knot / Zola / Joy / Minted; positioning:
  "gamified planning + multicultural-first").
- Add `docs/GLOSSARY.md` (§1.3), `docs/CULTURAL-TRADITIONS.md` (§1.4), and
  `docs/I18N.md` — the contributor guide: how to add a locale, key naming rules, ICU examples,
  what must never be translated (slugs, enum values, template keys), and the translation
  workflow (hand-off format, whether a TMS like Crowdin/Lokalise comes later).
- Commit message convention and code comments in English going forward.

### Phase 6 — Verification

1. CI gates: `bun run lint:i18n` (no inline user-facing strings) + `bun run lint:catalogs`
   (key parity vs `en`) + zero-CJK grep on code paths.
2. **Pseudo-locale test:** generate an `en-XA` catalog (accented + 35% padded strings) and
   walk the app — catches hardcoded leftovers and layout overflow before real translators
   are hired. Cheapest possible proof the i18n layer actually works.
3. Migration up/down on a scratch DB; regenerate a wedding and diff module counts for
   base / +South Asian / +Chinese / elopement.
4. Manual pass of onboarding → board → quest detail in the browser.
5. Typecheck + build all workspaces.

### Sequencing & rough effort

| Phase | Depends on | Size |
|---|---|---|
| 0 Decisions | — | 15 min |
| 1 Schema/types | 0 | S |
| 1b `packages/i18n` + wiring | 1 | M |
| 2 Quest content + culture packs | 1b | **L** (dominant) |
| 3 Web UI | 1b | M |
| 4 API + mobile | 3 | M |
| 5 Docs | 2 | M |
| 6 Verification | all | S |

Adding i18n infrastructure costs roughly one extra M-sized phase up front (1b) and makes
Phases 3–4 modestly slower (extract-to-key instead of edit-in-place). It removes a
full re-plumbing pass later, so it pays for itself the moment a second locale is on the roadmap.

### After this plan: adding `es` / `zh`

1. Add the locale to `SUPPORTED_LOCALES`, create `locales/<l>/` + `content/<l>/quests.json`.
2. Translate; parity CI tells you what's missing.
3. Locale-specific review: currency stays USD, Chinese has no plural forms (ICU `other` only),
   Spanish needs longer layouts and gendered role terms (novio/novia — decide neutral phrasing
   for a same-sex-inclusive product).
4. No code changes required. That's the acceptance criterion for Phase 1b.

**Open questions for you:**
1. Ship cultural packs in v1, or base US tree first and packs in v1.1?
2. Keep the mobile app in scope for this pass, or web + API only?
3. Do you want the RMB→USD budget change to be a hard cut (no migration of existing rows) —
   the DB currently has no real users, so I'd do a hard cut unless you say otherwise.
4. URL shape for the default locale: prefix-less `/board` (my recommendation) or `/en/board`?
5. Which locale ships second, `es` or `zh`? It only affects doc examples and review priorities,
   not the architecture.

---

## Sources

- [Zola — Ultimate Wedding Planning Checklist & Timeline](https://www.zola.com/expert-advice/your-ultimate-wedding-planning-checklist)
- [Loverly — 12-Month Wedding Timeline](https://loverly.com/planning/wedding-101/12-month-wedding-timeline)
- [planning.wedding — 12 Month Checklist](https://planning.wedding/timeline/checklist)
- [The Knot — Average Wedding Cost](https://www.theknot.com/content/average-wedding-cost)
- [The Knot Worldwide — 2026 Real Weddings Study](https://www.theknotww.com/press-releases/the-knot-worldwide-unveils-2026-real-weddings-study)
- [The Knot — Wedding Budget Breakdown](https://www.theknot.com/content/wedding-budget-ways-to-save-money)
- [MyWeddingKit — Wedding Budget Percentages 2026](https://myweddingkit.co/blog/wedding-budget-percentages)
- [G Squared Weddings — Wedding Glossary (400+ terms)](https://gsquaredweddings.com/wedding-glossary/)
- [Jessica Dum — Common Wedding Terminology](https://jessicadum.com/resources-common-wedding-terminology/)
- [WedSociety — Wedding Terminology Guide](https://www.wedsociety.com/article/wedding-terminology/)
- [The Knot — Multicultural Wedding Planning Advice](https://www.theknot.com/content/multicultural-wedding-tips)
- [David's Bridal — Blending Wedding Traditions from Two Cultures](https://www.davidsbridal.com/content/wedding-traditions/how-to-beautifully-blend-wedding-traditions-from-two-cultures)
- [Wikipedia — Baraat](https://en.wikipedia.org/wiki/Baraat)
- [FindLaw — Marriage License Requirements](https://www.findlaw.com/family/marriage/marriage-license-requirements.html)
- [Herman Legal Group — How to Obtain a Marriage License in the US and Abroad](https://www.lawfirm4immigrants.com/how-to-get-a-marriage-license-in-the-us/)
- [Assorted Artistries — Getting Married in New York: Licenses & Officiants](https://assortedartistries.com/2026/04/14/how-to-get-married-in-new-york/)
