# Bliss PRD v2 — An Agent-Native Wedding Planning Companion

**Status:** Draft v2 · Supersedes v1 ("闯关式婚礼任务规划器")
**Date:** 2026-08-12
**Market:** United States, English-only ship, multicultural-first (see [docs/US-MARKET-PLAN.md](docs/US-MARKET-PLAN.md))
**Architecture reference:** [docs/AGENTIC-SYSTEM-REFERENCE.md](docs/AGENTIC-SYSTEM-REFERENCE.md)

---

## 1. Positioning

Bliss is a wedding planning companion. It turns the tangle of small, tedious, and
thrilling things that make up an engagement into the right to-do list at the right time —
so a couple always knows what to do next and when. Through quest milestones and big
moments, it converts the pressure of the first major challenge two people face together
into something they remember fondly rather than survive.

**The goal is to become the companion they actually enjoy opening.**

**Core idea: make planning a wedding feel like an adventure the two of you are on together.**

### 1.1 What changed from v1, and why

v1 defined the product as a mechanism: *"input your requirements, the system generates a
modular expandable to-do board; each module is a game level."* That describes an
information architecture. Information architecture is not a differentiator — a wedding
checklist is free on Pinterest, and a spreadsheet does the same job.

Three corrections:

| v1 | v2 |
|---|---|
| The gamified board **is** the product | The board is a **means**; the companion relationship is the product |
| Task lists are **pre-authored and shipped** | Task lists are **generated from the couple's decisions** |
| Modules unlock in sequence | Modules are **all open**; the timeline nudges instead of gating |
| Photos and notes are records the user writes | **Moments are a byproduct** of deciding — the system saves them, not the user |

### 1.2 The granularity problem, and how v2 solves it

The unsolvable-looking problem in v1: task granularity varies enormously. "Attire" for one
couple means *rent a dress, done*; for another it means dress shopping, three fittings, a
bustle, a veil, a second look, nail design, a skincare plan. You cannot enumerate this in
advance.

**The resolution: stop trying to enumerate it in advance.** A task list is not an input to
a decision, it is the *output* of one. Once the couple has chosen "rent," the list writes
itself and never mentions alterations.

This gives the product its central seam:

| Layer | Fixed or generated | Why |
|---|---|---|
| **Quests** (14) | Fixed | Every US wedding has a venue, a photographer, a guest list. This is consensus knowledge. |
| **Tasks** inside a quest | Generated per couple | Entirely dependent on choices: rent vs. buy, plated vs. buffet, one culture or two. |

### 1.3 The differentiator

Every decision a couple makes — and the *reason* behind it — is captured as it happens.
"You chose a custom gown because you wanted to keep it for your daughter." Nobody typed
that into a journal; it fell out of answering a question the assistant asked.

At the end, the to-do list has been consumed. The decision trail remains. That trail is
the book of how the two of you built this together, and it is the thing no checklist app
can copy.

---

## 2. Architecture Stance

> Bliss is a system whose skeleton is a **deterministic, consensus-driven workflow**, with
> **agentic loops embedded at the decision points**.

This is a deliberate stance, and both halves matter.

**Deterministic skeleton.** Scheduling, progress, unlock nudges, budget rollups, and
template filtering are ordinary code. They must be fast, reproducible, and correct. Handing
them to a model makes them slower, costlier, and non-reproducible for zero benefit.

**Agentic at decision points.** Deciding *which questions to ask this couple right now*, and
*when enough is known to commit a list*, cannot be branched in advance. That is a loop, and
it is where the model belongs.

### 2.1 Agent-native, not agent-enabled

| | Agent-enabled | **Agent-native (Bliss v2)** |
|---|---|---|
| Where the agent lives | A chat box in the sidebar | The main interaction path |
| Task rows | Static seeded constants | Products of a decision, with provenance |
| Row fields | `title`, `done` | + `source`, `confidence`, `rationale`, `i18nKey` |
| Being wrong | An error | A proposal the user corrects — and the correction becomes memory |

The test is not "how many agents does it have." It is whether the product's primitives are
designed for an actor that acts, misremembers, and gets corrected.

### 2.2 Count loops, not agents

Each loop is an entry point for cost, latency, and non-determinism. Bliss budgets **two**:

1. **Scoping Loop** — entered when a couple opens a quest that has not been scoped. Goal:
   turn the quest into a concrete list. Terminates on `commit_tasks`, or when the user says
   "that's enough for now."
2. **Companion Loop** — general conversation: answer, adjust, reassure. Terminates when no
   tool calls remain.

Everything else in the system is deterministic.

### 2.3 One agent with skill packs, not many agents

Depth per quest ("the florals quest should really understand florals") comes from
**specialized context**, not from a separate agent process. Each quest carries its own
skill pack: system prompt, question bank, candidate task pool, and tool subset. The runtime
loop is the same one.

**Why not one agent per quest:**

- Every agent boundary is a lossy handoff; the judgments an agent did not verbalize are lost.
- Implicit decisions collide. An Attire agent inferring "budget-conscious" and a Rings agent
  inferring "splurge-worthy" each produce a defensible list; together they produce an
  assistant that appears to have no idea who you are. Users have near-zero tolerance for
  this.
- Attribution collapses. One agent yields a trace; five yield a forest where every agent
  looks individually correct.
- Cost and latency multiply; quality does not.

**The rule that decides it: parallelize reads, serialize writes.**

| Work | Shape | Decision |
|---|---|---|
| "Find 5 garden-style venues near Seattle under $15k" | Read-only, independent, mergeable | **Parallel subagents are fine** |
| "Decide this quest's tasks, write them, adjust the timeline" | Write path, must stay self-consistent | **One agent, serialized** |

---

## 3. The Core Interaction: Scoping a Quest

This replaces v1's "quest intro screen → pre-written checklist."

```
Open a quest
   │
   ├─ Already scoped? → show the list, enter Companion mode
   │
   └─ Not scoped:
      1. Scenario screen        static copy, no model call, instant
      2. Agent reads profile + prior decisions + timeline pressure
      3. Agent asks 2–3 binary questions it does not already have answers to
         ├─ User picks           → record_decision(confidence: 'decided')
         └─ "You decide for me"  → agent infers from profile
                                   → record_decision(confidence: 'assumed')
      4. propose_tasks — filtered from the pool by tags, adapted, rationale attached
      5. User reviews, edits, confirms → commit_tasks
      6. Enter Companion mode
```

### 3.1 Four rules this flow must obey

**Binary choices before free text.** Asking a stressed person to "describe your vision in
detail" is asking for work. The people who most need help are the least able to answer it.
"Renting or buying the dress?" is an order of magnitude easier and is already enough to cut
the list. A free-text field stays available beside it for people with opinions.

**"You decide for me" is a first-class path, not a fallback.** It is what anxious users
want. Recorded as `assumed`, not `decided`, so the assistant can circle back naturally:
*"I went with X for you back then — still right?"*

**Never gate the list behind the conversation.** At any point the user can take a
reasonable default list and leave. Conversation makes the list fit better; it is not the
price of admission.

**The scenario screen never calls the model.** Static copy renders instantly while the
agent thinks in the background. This is the difference between a product that feels quick
and one that feels like it is buffering.

### 3.2 No locks, only nudges

v1's `locked` state is removed. Any quest can be opened at any time — people start where
they are most anxious, and that is legitimate.

But order is not pure ceremony: the venue and date determine guest count, budget, and
season; a custom gown genuinely needs six months. So the hard gate becomes a soft signal:

> "Worth mentioning — you haven't locked a venue yet, and it drives a lot of what comes
> after. Want to spend ten minutes on that first?"

---

## 4. Content Model: A Pool, Not A List

The AI does not invent tasks. It **selects, prunes, and adapts** from an authored pool.

```ts
QuestTemplate {
  key: 'attire_beauty'
  i18nKey: 'quest.attire.title'
  order, prerequisites, estimatedDays
  cultures?: Culture[]          // culture-pack contributions
  weddingTypes?: WeddingType[]  // pruned for elopement / micro / destination

  scenario: i18nKey             // static opening copy
  scopingQuestions: ScopingQuestion[]
  taskPool: TaskTemplate[]
}

ScopingQuestion {
  key: 'attire.dress_acquisition'
  prompt: i18nKey               // "Renting or buying the dress?"
  options: [{ value: 'rent' | 'buy_offrack' | 'buy_custom', label: i18nKey }]
  allowsDefer: true             // the "you decide" path
  inferenceHint: i18nKey        // how to infer from profile when deferred
}

TaskTemplate {
  key, i18nKey
  appliesWhen: Predicate[]      // ['attire.dress_acquisition in (buy_offrack, buy_custom)']
  effortHours: number
  leadTimeDays: number
  leadTimeReason?: i18nKey      // 'Alterations take 6–8 weeks'
  earliestStart?, latestFinish? // hard constraints, e.g. license validity window
  dependsOn: TaskKey[]
  compressible: boolean
  isOptional: boolean
}
```

**Why a pool instead of free generation:**

- Quality is controlled — the model cannot invent wrong wedding advice, and a wrong task in
  a one-shot, high-stakes event is far more costly than a missing one.
- It is cheap and low-latency.
- It is **reproducible**: same profile + same answers ⇒ same list. Filtering runs on
  deterministic `appliesWhen` predicates; the model only chooses which questions to ask.
- The 14-quest content investment retains its full value.
- It is translatable — copy lives in `packages/i18n`, structure lives in code.

Free generation is permitted only where the pool genuinely cannot reach ("we want our dog
as ring bearer"), and is tagged `source: 'ai'` with a rationale.

### 4.1 The 14 quests

Per [US-MARKET-PLAN.md](docs/US-MARKET-PLAN.md) §Phase 2:

1. **Foundation** — budget, draft guest count, priorities, planner decision, wedding insurance
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
12. **Legal & Paperwork** — marriage license, officiant legitimacy, witnesses, certified copies, name change
13. **Pre-Wedding Events** — engagement party, showers, bachelor/ette, welcome party, rehearsal dinner
14. **Final 30 Days & Day-Of** — final headcount, seating chart, run of show, tips, emergency kit, rehearsal

Plus **cultural add-on packs** (South Asian, Chinese, Jewish, Korean, Nigerian, Mexican,
Persian, and more) that merge additively into the base tree.

---

## 5. Time: Effort vs. Lead Time

The "12-month timeline" from every wedding blog is not a standard. It is one point on an
elastic curve. Modeling it as a constant is wrong; modeling it as *uniformly scalable* is
also wrong.

**Two quantities behave in opposite ways:**

| | **Effort** | **Lead Time** |
|---|---|---|
| What it is | Hours the couple actually spends | Calendar time no amount of effort removes |
| Examples | Collecting inspiration (2h), a dress appointment (half a day) | Alterations 6–8 weeks; invitation printing 2 weeks; **marriage license waiting period, 3 days by law** |
| Compressible | Yes — parallelize, lower the bar, work more hours | **No** |
| Elastic input | `weddings.weeklyCapacityHours` | none |

**Compressing a 12-month plan into 6 months is therefore three steps, not one:**

1. Lead-time nodes keep their duration; they can only move earlier.
2. Effort nodes are redistributed against the couple's weekly capacity — the real elastic
   dial (3 h/week vs. 8 h/week vs. full-time changes everything).
3. **When it still does not fit, change the choice, not the schedule.** A custom gown has a
   six-month lead time; a rental has two weeks. The correct move is to reopen the decision.

### 5.1 Scheduling is CPM, backwards

Tasks form a DAG with durations and dependencies. Standard critical-path method computes
the earliest finish; a wedding date is **fixed**, so Bliss schedules backwards from it to a
latest-start date per task.

```
slack = latest_start − earliest_start

slack > 0   buffer — safe to leave alone
slack = 0   on the critical path — one day late is one day late for everything
slack < 0   INFEASIBLE — physically cannot fit
```

**Negative slack is the trigger.** The scheduler does not decide what to do about it; it
hands the fact to the agent, which proposes an option swap:

> "Custom alterations won't fit in the five months you have left. Renting takes two weeks —
> want to see what that version of this quest looks like?"

This is the payoff of decision-driven lists: **timeline pressure feeds back into the
scoping questions** instead of surfacing as a red warning banner nobody can act on.

**Division of labor: arithmetic to code, tradeoffs to the model.**

The 12–18 / 9–12 / 6–8 month tables in every planning guide are hand-computed CPM results.
Making them computable is what lets Bliss serve the couple with six months, three hours a
week, and a rented dress.

---

## 6. Memory

Three tiers, all structured. Deliberately **no vector store in v1** — a couple generates
perhaps 100–200 decisions total, which fits in context. Vector search solves "too much to
remember"; that is not the problem here, and it costs precision.

### 6.1 Semantic — facts (overwritable)

```ts
CoupleProfile {
  styleKeywords: string[]
  budgetPosture: 'value-conscious' | 'balanced' | 'splurge-on-priorities'
  decisionStyle: 'has-opinions' | 'wants-options' | 'wants-to-be-led'
  cultures: Culture[]
  familyDynamics: string
  hardConstraints: string[]
  ruledOut: { item: string, reason: string }[]
  weeklyCapacityHours: number
}
```

`ruledOut` is the most underrated field. The fastest way to destroy trust is to recommend,
for the third time, something the couple already rejected.

### 6.2 Episodic — what happened (append-only, never overwritten)

```ts
Decision {
  id, weddingId, questKey
  question: 'Renting or buying the dress?'
  choice: 'buy_custom'
  reason: 'Want to keep it for our daughter'      // ← the soul of the product
  confidence: 'decided' | 'assumed'
  decidedBy: userId, decidedAt
  supersedes: DecisionId | null                   // changed your mind: link, never delete
  photoIds: [], costCents: null
}
```

Changing your mind links rather than overwrites, because *"we were going to rent, then
decided to buy, so she could keep it"* is worth more than the conclusion. **This table is
where moments live.**

### 6.3 Procedural — how to do things

Quest templates, scoping question banks, system prompts, tool definitions. Changes slowly
and **only through the eval pipeline** — letting the agent rewrite its own methods at
runtime is the fastest route to quality collapse.

### 6.4 Moments are a byproduct, never homework

Wedding planning happens under stress. Any feature that asks people to *write more in order
to preserve memories* will be abandoned — this is how journaling apps die.

So: the user checks boxes, picks options, uploads the photo they were taking anyway. The
narrative is assembled by a background job from decisions + photos + timing at celebration
points. **User-authored input required: approximately zero.**

---

## 7. Tools and Guardrails

Reads may be broad. **Writes must be narrow, validated, and reversible.**

```ts
// Reads
get_wedding_context()      get_quest(questKey)      get_decisions(questKey?)
get_timeline_pressure(questKey)                     lookup_marriage_license(state, county?)

// Writes — every one is user-visible
propose_tasks(questKey, tasks[], rationale) → { proposalId }   // proposal only, not persisted
commit_tasks(proposalId, edits?)            → { created: Task[] }
record_decision({ questKey, question, choice, reason, confidence })
update_profile(patch, evidence)             // whitelisted fields only
adjust_timeline(questKey, changes, reason)
```

### 7.1 Four hard guardrails

1. **Two-phase writes.** The model may never mutate a couple's list, dates, or budget
   directly. `propose_tasks` → user confirms → `commit_tasks`. This removes most of the
   "the AI changed my stuff" failure class, and the confirmation click is exactly the moment
   a decision — and therefore a moment — occurs.
2. **No invented tasks.** Selection from the pool by deterministic predicates. Exceptions
   tagged `source: 'ai'` with a rationale.
3. **Legal and lead-time facts come from lookup tables, never from the model.**
   `lookup_marriage_license` is a table read. A three-day waiting period computed wrong
   means the wedding cannot legally happen. Informational, with a "consult an attorney"
   disclaimer.
4. **Determinism.** Same profile + same answers ⇒ same list.

---

## 8. Evaluation

Because filtering is deterministic and decisions are structured, this is testable. Golden
paths, run in CI:

| Scenario | Expectation |
|---|---|
| 12 months · rented gown · no planner | No "alterations" or "final fitting" tasks; includes "break in the shoes" |
| 6 months · custom gown | Attire slack goes negative; agent proposes rental or off-the-rack |
| Chinese + American, venue in WA | Tea ceremony tasks appear; license follows WA 3-day waiting period |
| `ruledOut` includes destination wedding | No destination tasks in any quest, ever again |
| **User answers "you decide" to everything** | Still produces a complete, usable plan, all `assumed` |
| Elopement type | Quests 4, 7, 13 pruned; Legal quest promoted to first |

The fifth row is the most important test in the suite. **If a couple who types nothing
still gets a good plan, the product works.**

### 8.1 Instrument from day one

Persist every `(profile, answers, generated list)` triple and a trace of every scoping run
from the first commit. This is the future eval dataset. It costs almost nothing now and
cannot be reconstructed later.

---

## 9. Data Model Deltas from v1

```
weddings
  + state, city, currency ('USD'), cultures[], weddingType
  + weeklyCapacityHours
  + guestCountExact (primary; range becomes fallback)

couple_profiles                          NEW — semantic memory
decisions                                NEW — episodic memory, append-only, supersedes
task_proposals                           NEW — pending propose_tasks output
quest_scopings                           NEW — per-quest conversation + outcome
moments                                  NEW — generated narrative artifacts
agent_runs                               NEW — trace + eval dataset source

modules → quests
  − status 'locked'                      replaced by timeline nudges
  + i18nKey

tasks
  + i18nKey, source ('template'|'ai'|'user'), confidence, rationale
  + effortHours, leadTimeDays, leadTimeReason
  + earliestStart, latestFinish, dependsOn[], compressible
```

Removed from v1: `budget` and `guests` as standalone modules (budget stays a cross-cutting
concern; guests fold into quests 6 and 7), stage-based seeding, and the unlock gate.

---

## 10. Build Order

The sequence matters more than usual here, because **each step is independently valuable
and the AI arrives late on purpose.**

| Phase | What | Why here |
|---|---|---|
| **0** | Lock decisions from US-MARKET-PLAN §Phase 0 | 15 min, unblocks everything |
| **1** | Schema + types + `packages/i18n` | Foundation for both content and i18n |
| **2** | Author quest content: scenario, scoping questions, tagged task pool | **Dominant effort.** Start with Attire & Beauty end to end |
| **3** | **Template Resolver — pure function, deterministic, no model** | ⚠️ At the end of this phase, "rent" and "custom" already yield two visibly different, good lists — **with zero AI code written.** This is the cheapest possible validation of the entire thesis |
| **4** | CPM scheduler: effort/lead-time, backward pass, negative slack | Still deterministic; produces the trigger the agent needs |
| **5** | Scoping Loop agent + tools + two-phase writes + traces | The model finally enters, with a working system to stand on |
| **6** | Companion Loop, memory read/write policy | |
| **7** | Moments generation, celebrations, sharing | The harvest, not the foundation |
| **8** | Eval suite promoted to a CI release gate | |

**Maturity target: L3** (an agent with memory) per
[docs/AGENTIC-SYSTEM-REFERENCE.md](docs/AGENTIC-SYSTEM-REFERENCE.md) §成熟度分级.
Today the codebase is L0. The prerequisite for L3 is not L2 — it is **doing L1
exceptionally well**, which is precisely what Phase 3 delivers.

---

## 11. Out of Scope for v1

- **MCP integrations** (Google Calendar, vendor directories, contract email ingestion). The
  bottleneck is the mechanism, not the data. These are strong additions once lists and
  memory are trustworthy.
- **Vector-store memory.** Structured tables are more accurate, cheaper, and debuggable at
  this scale. Revisit if episodic history genuinely outgrows the context window.
- **Multi-agent orchestration.** Parallel read-only subagents for vendor search may be
  introduced under the parallelize-reads/serialize-writes rule; the write path stays single.
- **Partner collaboration, vendor CRM, gantt UI.** Valuable, but they multiply the surface
  area before the core thesis is proven.

---

## 12. Open Questions

1. Cultural packs in v1, or base US tree first and packs in v1.1?
2. Mobile in scope for the v2 rewrite, or web + API only?
3. Does the Companion Loop get a persistent chat surface, or does conversation only exist
   inside quest scoping? (Recommendation: scoping-only in v1 — a general chat box invites
   questions the system cannot yet answer well.)
4. Who is the assistant, in voice terms — a planner, a friend who has done this, or a
   neutral tool? This drives every piece of copy and should be locked before Phase 2.
