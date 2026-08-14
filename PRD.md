# Bliss — Product Requirements

**Date:** 2026-08-13
**Market:** United States · English-only ship · multicultural-first
**Related:** [DESIGN.md](DESIGN.md) for how it is built ·
[docs/MARKET.md](docs/MARKET.md) for the research behind every number here

---

## 1. What Bliss is

Bliss is a wedding planning companion. It turns the tangle of small, tedious, and
thrilling things that make up an engagement into the right to-do list at the right
time — so a couple always knows what to do next and when.

**Goal: become the companion they actually enjoy opening.** Not the tool they
comply with. Planning a wedding is the first major project two people run
together, and Bliss should make it feel like an adventure they are on rather than
a burden they survive.

**One sentence of product:** answer two questions about how you want to do a
thing, and get the short list of what that actually takes, scheduled backwards
from your date.

## 2. Who it is for

US couples planning their own wedding, with or without a planner. Three postures
matter more than demographics:

| Posture | What they need |
|---|---|
| **Anxious** — no idea where to start, afraid of forgetting something | To be told the next step, and to be able to say "you decide" |
| **Opinionated** — has a vision, wants execution | Not to be lectured; a list that respects their choices and shows lead times |
| **Compressed** — six months, a full-time job, three hours a week | A plan that is honest about what does not fit, and what to change instead |

**Multicultural and immigrant families are the sharpest wedge.** About one in four
US couples blends two traditions, and for them every generic checklist is wrong in
the same way: it omits half their events, their vendors, and their lead times.

## 3. The core thesis

The hard problem in wedding planning software is **task granularity**. "Attire"
for one couple means *rent a dress, done*. For another it means dress shopping,
three fittings, a bustle, a veil, a second look, nail design, and a skincare plan.
No authored checklist can be right for both, which is why every checklist product
settles for being vaguely right for nobody.

**The resolution: stop trying to enumerate it in advance. A task list is not an
input to a decision, it is the output of one.** Once the couple has chosen "rent,"
the list writes itself and never mentions alterations.

That gives the product its central seam:

| Layer | Fixed or generated | Why |
|---|---|---|
| **Quests** (14) | Fixed | Every US wedding has a venue, a photographer, a guest list, a license. This is consensus knowledge. |
| **Tasks** inside a quest | Generated per couple | Entirely dependent on choices: rent vs. buy, plated vs. buffet, one culture or two. |

### 3.1 The 14 quests

1. **Foundation** — budget, draft guest count, priorities, planner decision, insurance
2. **Venue & Date** — tour checklist, F&B minimum, COI, rain plan, contract review
3. **Vendor Dream Team** — photographer, videographer, caterer, DJ/band, officiant, content creator
4. **Wedding Party & VIPs** — asks, roles, attire, gifts, duties
5. **Attire & Beauty** — gown timeline (order → 3 fittings → bustle), suits, hair and makeup trial
6. **Guest List & Stationery** — save-the-dates, wedding website, invitation suite, RSVP with meal choice
7. **Guest Experience & Travel** — hotel room blocks, shuttles, welcome bags, out-of-town guests
8. **Food & Beverage** — tasting, service style, bar package, dietary needs, vendor meals, cake
9. **Design, Flowers & Rentals** — mood board, florals, tablescape, lighting, rentals, signage
10. **Ceremony** — officiant, script, vows, readings, processional order, music, unity ritual
11. **Registry, Rings & Honeymoon** — registry, bands, passports, PTO, travel
12. **Legal & Paperwork** — marriage license, officiant legitimacy, witnesses, certified copies, name change
13. **Pre-Wedding Events** — engagement party, showers, bachelor/ette, welcome party, rehearsal dinner
14. **Final 30 Days & Day-Of** — final headcount, seating chart, run of show, tips, emergency kit, rehearsal

Plus **cultural add-on packs** that merge additively into this tree, and
**wedding-type pruning** — an elopement generates 8 quests, not 14.

## 4. The advantage

**Against The Knot, Zola, Joy, and a spreadsheet** (see
[docs/MARKET.md](docs/MARKET.md) § Competitors) Bliss claims three things none of
them do:

**1. The list is yours, and it says why.** Every task carries the reason it is on
the list — *"included because you chose a custom gown."* A user who can see why can
correct the underlying decision instead of silently deleting a row, and that
correction is worth far more to the system than the deletion.

**2. Lead time is modeled as a constraint, not as advice.** Authored production
lead times and fresh, jurisdiction-specific license rules become hard scheduling
constraints. Bliss knows when a plan is physically impossible and says so early
enough to matter; if an authoritative legal rule is unavailable, it refuses to
estimate.

**3. Culture changes the plan, not the copy.** Selecting two heritages changes
which events exist, which vendors are needed, and when fabric has to be sourced.
Elsewhere this is a blog post.

### 4.1 The thing no checklist can copy

Every decision a couple makes — and the *reason* behind it — is captured as it
happens. *"You chose a custom gown because you wanted to keep it for your
daughter."* Nobody typed that into a journal; it fell out of answering a question
the assistant asked.

At the end, the to-do list has been consumed. **The decision trail remains, and it
is the record of how the two of you built this together.**

## 5. Architecture stance

> Bliss is a system whose skeleton is a **deterministic, consensus-driven
> workflow**, with **agentic loops embedded at the decision points.**

Both halves are deliberate.

**Deterministic skeleton.** Scheduling, progress, nudges, budget rollups, and
template filtering are ordinary code. They must be fast, reproducible, and
correct. Handing them to a model makes them slower, costlier, and
non-reproducible for zero benefit.

**Agentic at the decision points.** Which questions to ask *this* couple right
now, and when enough is known to commit a list, cannot be branched in advance.
That is a loop, and it is the only place the model belongs.

**Rule of thumb for every new feature:** if the answer is computable, it is not
the agent's job. The agent exists for questions that have no correct answer, only
a fitting one.

### 5.1 Agent-native, not agent-enabled

| | Agent-enabled | **Agent-native** |
|---|---|---|
| Where the agent lives | A chat box in the sidebar | The main interaction path |
| Task rows | Static seeded constants | Products of a decision, with provenance |
| Row fields | `title`, `done` | + `source`, `confidence`, `rationale` |
| Being wrong | An error | A proposal the user corrects — and the correction becomes memory |

The test is not how many agents a product has. It is whether its primitives are
designed for an actor that acts, misremembers, and gets corrected.

### 5.2 Count loops, not agents

Every loop is an entry point for cost, latency, and non-determinism. Bliss budgets
**two**:

1. **Scoping Loop** — entered when a couple opens an unscoped quest. Goal: turn
   the quest into a concrete list. Terminates on commit, or when the user says
   that is enough for now.
2. **Companion Loop** — general conversation: answer, adjust, reassure.

Everything else is deterministic.

### 5.3 One agent with skill packs, not many agents

Depth per quest ("the florals quest should really understand florals") comes from
**specialized context**, not a separate agent process. Each quest carries its own
skill pack — prompt, question bank, candidate task pool, tool subset — over one
shared runtime loop. Why not one agent per quest:

- Every agent boundary is a lossy handoff; judgments an agent never verbalized are lost.
- Implicit decisions collide. An Attire agent inferring "budget-conscious" and a
  Rings agent inferring "splurge-worthy" each produce a defensible list; together
  they produce an assistant that appears to have no idea who you are. Users have
  near-zero tolerance for this.
- Attribution collapses. One agent yields a trace; five yield a forest in which
  every agent looks individually correct.
- Cost and latency multiply. Quality does not.

**The rule that decides it: parallelize reads, serialize writes.** Finding five
garden venues under $15k is independent and mergeable, so subagents are fine.
Deciding a quest's tasks and adjusting the timeline must stay self-consistent, so
it is one agent, serialized.

## 6. The core experience: scoping a quest

```
Open a quest
   │
   ├─ Already scoped? → show the list, enter Companion mode
   │
   └─ Not scoped:
      1. Scenario screen        static copy, no model call, instant
      2. Agent reads profile + prior decisions + timeline pressure
      3. Agent asks 2–3 binary questions it cannot already answer
         ├─ User picks           → decision recorded as 'decided'
         └─ "You decide for me"  → inferred from profile, recorded as 'assumed'
      4. Tasks proposed — filtered from the pool, adapted, rationale attached
      5. User reviews, edits, confirms → committed
      6. Enter Companion mode
```

### 6.1 Rules this flow must obey

**Binary choices before free text.** Asking a stressed person to "describe your
vision in detail" is asking for work, and the people who most need help are the
least able to answer it. "Renting or buying the dress?" is an order of magnitude
easier and already enough to cut the list in half. Free text stays available
beside it for people with opinions.

**"You decide for me" is a first-class path, not a fallback.** It is what anxious
users want. Recorded as `assumed` rather than `decided`, so the assistant can
circle back naturally: *"I went with X for you back then — still right?"*

**Never gate the list behind the conversation.** At any point the user can take a
reasonable default list and leave. Conversation makes the list fit better; it is
not the price of admission.

**The scenario screen never calls the model.** Static copy renders instantly while
the agent thinks. This is the difference between a product that feels quick and
one that feels like it is buffering.

**No locks, only nudges.** Any quest opens at any time — people start where they
are most anxious, and that is legitimate. Order still matters, because the venue
and date drive guest count, budget, and season, so the hard gate becomes a soft
signal: *"Worth mentioning — you haven't locked a venue yet, and it drives a lot
of what comes after. Want to spend ten minutes on that first?"*

## 7. Time: effort versus lead time

The 12-month timeline from every wedding blog is one point on an elastic curve.
Modeling it as a constant is wrong; modeling it as uniformly scalable is also
wrong, because two quantities behave in opposite ways:

| | **Effort** | **Lead time** |
|---|---|---|
| What it is | Hours the couple actually spends | Calendar time no amount of effort removes |
| Examples | Collecting inspiration, a dress appointment | Alterations 6–8 weeks; invitation printing 2 weeks; license waiting period, 3 days by law |
| Compressible | Yes — parallelize, lower the bar, work more hours | **No** |
| Elastic input | The couple's weekly capacity | none |

So compressing twelve months into six is three steps, not one:

1. Lead-time nodes keep their duration. They can only move earlier.
2. Effort nodes are redistributed against weekly capacity — the real dial. Three
   hours a week versus eight changes everything.
3. **When it still does not fit, change the choice, not the schedule.** A custom
   gown has a six-month lead time; a rental has two weeks. The correct move is to
   reopen the decision:

   > "Custom alterations won't fit in the five months you have left. Renting takes
   > two weeks — want to see what that version of this quest looks like?"

This is the payoff of decision-driven lists: **timeline pressure feeds back into
the scoping questions** instead of surfacing as a red banner nobody can act on.
Arithmetic goes to code, tradeoffs go to the model. Mechanics in
[DESIGN.md](DESIGN.md) § CPM Scheduler.

## 8. Memory

Three tiers, all structured. **No vector store in v1** — a couple generates
perhaps 100–200 decisions in total, which fits in context. Vector search solves
"too much to remember," which is not the problem here, and it costs precision.

| Tier | Holds | Behavior |
|---|---|---|
| **Semantic** — the couple profile | Style, budget posture, decision style, cultures, family dynamics, hard constraints, things ruled out, weekly capacity | Overwritable facts |
| **Episodic** — decisions | The question, the choice, **the reason**, who decided, confidence, what it superseded | Append-only. Never overwritten |
| **Procedural** — how to do things | Quest templates, question banks, prompts, tool definitions | Changes only through the eval pipeline, never at runtime |

**`ruledOut` is the most underrated field.** The fastest way to destroy trust is
to recommend, for the third time, something the couple already rejected.

**Changing your mind links, it does not overwrite.** *"We were going to rent, then
decided to buy, so she could keep it"* is worth more than the conclusion. This is
also where moments live.

### 8.1 Moments are a byproduct, never homework

Wedding planning happens under stress. Any feature that asks people to write more
in order to preserve memories will be abandoned — this is how journaling apps die.
So the user checks boxes, picks options, and uploads the photo they were taking
anyway; the narrative is assembled by a background job from decisions, photos, and
timing. **User-authored input required: approximately zero.**

## 9. Guardrails

These are product promises, not implementation details. Enforcement is in
[DESIGN.md](DESIGN.md) § Agent Service.

1. **Two-phase writes.** The model never mutates a couple's list, dates, or budget
   directly. It proposes; the user confirms. This removes most of the "the AI
   changed my stuff" failure class, and the confirmation click is exactly the
   moment a decision — and therefore a moment — occurs.
2. **No invented tasks.** The agent selects, prunes, and adapts from an authored
   pool. A wrong task in a one-shot, high-stakes event is far more costly than a
   missing one. Free generation is allowed only where the pool genuinely cannot
   reach ("we want our dog as ring bearer"), and is labeled as such.
3. **Legal facts require fresh official-source data; lead times use authored
   deterministic data. Never model memory.** A waiting period computed wrong can
   make the ceremony invalid. Everything legal is informational, source-linked,
   and ships with an issuing-office or qualified-counsel disclaimer.
4. **Determinism.** Same profile plus same answers produces the same list.
5. **A wall of tasks is a failure.** Proposals are capped. If a quest needs 30
   tasks, the content is wrong.

## 10. Scope

### In scope for v1

- The 14 quests, authored end to end, with tagged task pools
- Cultural packs, shipping in v1 rather than deferred — they are the wedge
- Deterministic resolver and CPM scheduler
- Scoping Loop and Companion Loop, two-phase writes, traces from day one
- Decision trail and generated moments
- English only, on a real i18n layer — adding Spanish is a translation job
- Web only

### Deliberately not in v1

| Not doing | Why, and what would change our mind |
|---|---|
| **Native mobile app** | The previous one was deleted rather than localized; it targeted a data model that no longer exists. A native client is a rebuild against the quest API, and the shared ICU catalogs make it cheap when the web product is proven |
| **User-managed MCP connections and contract-email ingestion** | Provider adapters already sit behind stable Bliss contracts. Exposing arbitrary user-managed connections waits until permissions, consent, and support are proven |
| **Vector-store memory** | Structured tables are more accurate, cheaper, and debuggable at this scale. Revisit if episodic history outgrows the context window |
| **Multi-agent orchestration** | Parallel read-only subagents for vendor search may arrive under parallelize-reads/serialize-writes. The write path stays single |
| **Vendor CRM, gantt UI, planner/family roles** | Real value, but they multiply surface area before the core thesis is proven. The two authenticated partners already share one attributed wedding workspace |
| **Legal guarantees** | Informational with disclaimers, permanently. Bliss is not a law firm |

## 11. Success criteria

The product works if these hold. They run in CI as golden paths, because
filtering is deterministic and decisions are structured (see
[DESIGN.md](DESIGN.md) § Eval).

| Scenario | Expectation |
|---|---|
| 12 months · rented gown · no planner | No alterations or final-fitting tasks; includes "break in the shoes" |
| 6 months · custom gown | Attire slack goes negative; the agent proposes rental or off-the-rack |
| Chinese + American, ceremony in WA | Tea ceremony tasks appear; the license window is calculated only when a fresh, source-complete WA authority result is available |
| Destination wedding previously ruled out | No destination tasks in any quest, ever again |
| **The user answers "you decide" to everything** | Still produces a complete, usable plan, entirely `assumed` |
| Elopement | Guest-logistics quests pruned; Legal promoted to first |

**The fifth row is the most important test in the suite. If a couple who types
nothing still gets a good plan, the product works.**

Instrument from the first commit: persist every (profile, answers, generated list)
triple and a trace of every scoping run. That is the future eval dataset, it costs
almost nothing now, and it cannot be reconstructed later.

## 12. Open questions

1. **Launch blocker, not a question:** Bliss now refuses to fill any marriage-license
   field from a national default or model knowledge. The authority gateway requires
   fresh `.gov` sources with field-level provenance and returns
   `verification_required` when a jurisdiction is not covered. Launch still requires
   reviewed provider coverage for every supported jurisdiction before anyone relies
   on the calculated license window.

Voice and surface decisions are now locked: Bliss is the warm, capable companion in
[docs/VOICE.md](docs/VOICE.md), and v1 conversation lives inside a specific Quest decision
instead of an unbounded general-advice chat.
