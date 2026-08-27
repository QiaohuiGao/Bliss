# US Wedding Glossary

Terms Bliss uses **verbatim** in UI copy. Using the wrong word here is not a
style problem: a couple who confuses an escort card with a place card, or a
service charge with a gratuity, makes a real and expensive mistake.

**Definitions live in
[`packages/i18n/src/locales/en/glossary.json`](../packages/i18n/src/locales/en/glossary.json)**,
not in this file, so they can be surfaced as inline tooltips and translated like
any other string. This document explains *why* these particular terms matter and
which ones are load-bearing.

Internal system vocabulary — quest, scoping, packet, pack, thread — is a separate
list at the end of this file. None of it is user-facing.

---

## The terms that cause real damage when confused

| Confusion | Consequence |
|---|---|
| **Service charge** vs **gratuity** | A 20-25% service charge often does not reach the staff. Couples who assume it did under-tip; couples who budget for both are the only ones who are right. |
| **Escort card** vs **place card** | Escort cards send a guest to a *table*. Place cards assign a *seat*. Ordering the wrong one two weeks out is unrecoverable. |
| **Venue coordinator** vs **day-of coordinator** | The venue coordinator works for the venue. Couples who think they have a planner and do not are the single most common source of day-of chaos. |
| **Site fee** vs **food and beverage minimum** | The F&B minimum is usually the larger number and is quoted separately. Comparing venues on site fee alone is comparing the wrong number. |
| **Marriage license** vs **marriage certificate** | The license is the permit to marry. The certificate is proof you did. Name-change steps want the certificate. |
| **Waiting period** | Set by state law, cannot be waived. Three days in 17 states. Getting the license too late means the wedding is not legal on the day. |
| **Alterations lead time** | 6-8 weeks and 2-3 appointments, on top of a 6-9 month order time. The most underestimated number in wedding planning. |

---

## Categories covered in the catalog

- **Planning roles** — wedding planner (full-service, partial), day-of
  coordinator, venue coordinator, officiant, point person
- **Stationery and paper** — save-the-date, invitation suite, RSVP card,
  response deadline, escort card, place card, menu card, programs, signage,
  thank-you notes, calligraphy, inner/outer envelope, "and Guest"
- **Events** — engagement party, bridal shower, bachelor/bachelorette, welcome
  party, rehearsal, rehearsal dinner, first look, cocktail hour, grand entrance,
  first dance, parent dances, toasts, cake cutting, bouquet toss, last dance,
  send-off, after-party, farewell brunch
- **People** — wedding party, maid/matron of honor, best man, bridesmaids,
  groomsmen, attendants, flower girl, ring bearer, ushers, VIPs, processional
  order
- **Contracts and money** — retainer, COI, force majeure, service charge,
  gratuity, corkage fee, cake-cutting fee, plated / buffet / family-style /
  stations, open / limited / cash / consumption bar, BYOB, all-inclusive,
  minimum spend, vendor meal, overtime rate, site fee, setup/strike, final
  headcount
- **Design and rentals** — tablescape, centerpiece, charger, linens, chiavari
  chair, installation, arch/arbor/chuppah, ceremony backdrop, draping,
  uplighting, string lights, tenting, floor plan, seating chart, head table,
  sweetheart table, welcome table, guest book, escort display, flat lay, golden
  hour, getting-ready suite, shot list, run of show
- **Attire** — silhouette (A-line, ball gown, mermaid, sheath), alterations,
  bustle, veil lengths, dress codes (black tie, black tie optional, cocktail,
  semi-formal, dressy casual, garden party), tux vs suit, boutonnière, corsage
- **Types of wedding** — elopement, micro wedding, destination, courthouse,
  backyard, all-inclusive resort, second line, unplugged ceremony, content
  creator

---

## Copy rules

1. **Use the term, then explain it once.** Never invent a friendlier synonym.
   Couples will encounter the real term the moment they talk to a vendor, and a
   product that taught them a different word has actively hurt them.
2. **Attach the tooltip on first use per screen**, not every use.
3. **Numbers come from
   [docs/MARKET.md](MARKET.md) §2**, not from memory.
4. **Never state a legal fact from memory.** Marriage license rules come from
   `apps/api/src/content/marriage-license.ts` and always ship with the
   disclaimer key `quest.legal.disclaimer`.

---

## Deliberately not used

| Avoided | Instead | Why |
|---|---|---|
| "Bride" / "groom" as structural roles | "You", "your partner", "the couple" | The product must work for same-sex couples. Attire quests are named by garment, not by gender. |
| "The bride's family pays" | "Who's contributing" | Largely obsolete in the US, and never true for many immigrant families. |
| Auspicious-date logic | Season, venue availability, holiday weekends, off-peak pricing | Date choice in the US market is driven by pricing and guest travel. Lunar-calendar preferences belong to a culture pack, not to the base product. |

---

## System terminology

**None of these words belong in UI copy.** They name parts of the system, not
things a couple has ever heard of. A user sees "your choices," never "your
decision packet." The list is here rather than in the design docs because a
glossary is where someone actually looks a word up.

Full architecture in [AGENTIC-SYSTEM-DESIGN.md](AGENTIC-SYSTEM-DESIGN.md);
which file implements what in [CODE-MAP.md](CODE-MAP.md).

### The pairs that cause real damage when confused

| Confusion | Consequence |
|---|---|
| **Decision Packet** vs **domain pack** | A *packet* is one proposal awaiting approval. A *pack* is a bundle of tools and a prompt for one quest. They share four letters and nothing else. Almost every misread of `agent/` traces back to this pair. |
| **Decision proposal** vs **decision** | A proposal is what the model produced and nobody has approved. A decision is confirmed, append-only, and has consequences. Writing to the wrong one either loses the audit trail or commits something the couple never agreed to. |
| **Planning thread** vs **agent run** | A thread is durable and can span weeks. A run is one ephemeral execution inside it, minutes at most. Continuity belongs to the thread; anything a run keeps in memory is gone when it ends. |
| **Lead time** vs **effort** | Lead time is what the outside world needs regardless of motivation — 6-8 weeks of alterations. Effort is how long the couple is busy. Only effort compresses, which is why a plan cannot be scaled uniformly. |
| **Candidate pool** vs **task list** | The pool is every authored task the couple's answers permit, and it is meant to be large. The list is what gets materialized. A pool of 200 and a proposal of 8 are both correct. |
| **`assumed`** vs **`decided`** | An assumed answer came from the question's default so the plan is never empty. A decided one came from the couple. Presenting an assumption as a decision is the fastest way to lose trust. |

### Terms

| Term | Meaning | Lives in |
|---|---|---|
| **Quest** | One of the 14 major areas of a wedding: venue, attire, legal. Fixed set; every US wedding has them. | `content/quest-templates.ts` |
| **Section** | A group of tasks inside a quest — gown, suit, shoes, beauty. | same |
| **Scoping** | Asking the two or three questions that turn a general quest into a concrete list. The core interaction: a task list is the *output* of a decision, not an input to it. | `packs/quest-scoping.ts` |
| **Scoping question** | An authored multiple-choice question whose answer changes which tasks exist. Budget is two or three per quest — the point is to cut the list, not to conduct an interview. | `content/quest-templates.ts` |
| **Answer key** | A scoping question qualified by its quest namespace, e.g. `attire.dress_acquisition`. Predicates read these. | `services/quest-resolver.ts` |
| **Predicate** | One condition string in an `appliesWhen` tag: `attire.dress_acquisition == rent`. A deliberately tiny grammar — if a rule cannot be expressed in it, the content is usually wrong rather than the grammar. | `content/predicates.ts` |
| **Resolver** | Pure function from answers to a pruned quest tree. No model, no I/O, fully deterministic. | `services/quest-resolver.ts` |
| **Candidate pool** | The tasks the resolver says are valid for the current answers, handed to the model to select from. | `packs/*.ts` via `get_candidate_tasks` |
| **Planning thread** | One ongoing question the couple is working through, e.g. "choose a photographer." Status: `open`, `exploring`, `contested`, `ready`, `resolved`, `parked`. | `db/schema/agent.ts` |
| **Decision Packet** | The system's atomic unit. One proposal carrying everything a single decision implies: tasks, memory claims, external actions, and a Moment draft, behind one approval. | `agent/types.ts` |
| **Domain pack** | Tool definitions plus a prompt for one quest. Three exist: attire, photographer, and the generic quest-scoping pack covering the other twelve. One shared runtime, not separate agents. | `agent/packs/` |
| **Contested** | Both members expressed incompatible preferences. Not an error and not a permission state: a signal to stop optimizing tasks and clarify the trade-off. A contested packet cannot be confirmed. | `proposals/committer.ts` |
| **Commit boundary** | The confirm endpoint. Everything before it is reversible; past it, tasks and memory exist. Deliberately not reachable by the model. | `proposals/committer.ts` |
| **Memory claim** | One evidence-backed fact or preference, with its source message and confidence. The source of truth behind the profile. | `agent/memory/` |
| **Projection** | The profile summary recomputed from active claims. Derived, never authoritative — which is what makes a wrong inference correctable rather than baked in. | `agent/memory/projection.ts` |
| **Moment** | A narrative artifact generated from a confirmed decision, always a draft the couple saves or dismisses. Status: `suggested`, `saved`, `dismissed`. | `db/schema/agent.ts` |
| **Harness** | Everything around the model that is ordinary deterministic code: context assembly, the loop, tool dispatch, guardrails, tracing. Most of the work. | `agent/harness/` |
| **Run** | One bounded execution: a goal, a budget, and a stop reason. Ephemeral — nothing survives except what it wrote through tools. | `agent/harness/loop.ts` |
| **External action** | A real-world side effect such as an email or calendar event. Lifecycle: `draft`, `pending_approval`, `approved`, `executing`, `succeeded`/`failed`/`cancelled`. Always requires exact-payload approval. | `agent/actions/` |
| **Artifact bundle** | An immutable, versioned agent configuration: prompt, voice contract, tools, policy, model settings. A release ships a bundle, never "the latest prompt." | `agent/artifacts/registry.ts` |
| **Trace / span** | The causal tree of one run. Traces are the raw material for evals and cannot be reconstructed after the fact, which is why they are written from the first commit. | `agent/harness/trace.ts` |
