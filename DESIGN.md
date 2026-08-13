# Bliss Design Doc v2 — Technical Design

**Status:** Draft v2 · Supersedes v1
**Date:** 2026-08-12
**Implements:** [PRD.md](PRD.md) · [docs/US-MARKET-PLAN.md](docs/US-MARKET-PLAN.md)
**Concepts:** [docs/AGENTIC-SYSTEM-REFERENCE.md](docs/AGENTIC-SYSTEM-REFERENCE.md)

---

## 1. System Shape

```
┌──────────────────────────────────────────────────────────────┐
│  DETERMINISTIC CORE — plain code, fast, reproducible          │
│                                                               │
│  Template Resolver    predicate filtering over the task pool   │
│  CPM Scheduler        effort/lead-time, backward pass, slack   │
│  Progress Engine      completion, milestones, celebrations     │
│  Budget Engine        rollups, category allocation, alerts     │
│  Legal Rules          state-level marriage license lookup      │
└──────────────────────────────────────────────────────────────┘
                            ▲ tools
┌──────────────────────────────────────────────────────────────┐
│  AGENT SERVICE — one agent, two loop modes, skill packs        │
│                                                               │
│  Harness: context assembly · loop control · tool dispatch ·    │
│           guardrails · two-phase writes · tracing              │
└──────────────────────────────────────────────────────────────┘
                            ▲ memory
┌──────────────────────────────────────────────────────────────┐
│  MEMORY — Postgres, structured, no vector store in v1          │
│  couple_profiles (semantic) · decisions (episodic) ·           │
│  quest templates + prompts (procedural) · moments              │
└──────────────────────────────────────────────────────────────┘
```

**Rule of thumb for every new feature:** if the answer is computable, it is not the agent's
job. The agent exists for questions with no correct answer, only a fitting one.

### 1.1 Reuse vs. rewrite

| Area | Decision |
|---|---|
| Auth (Clerk), Fastify/Bun server, Drizzle, deploy config | **Keep** |
| `weddings`, `users`, `wedding_members` | **Extend** — new columns, no rebuild |
| `modules` → `quests`, `sub_modules`, `tasks` | **Rewrite** — new fields, drop the lock state |
| `quest-templates.ts` (Chinese, China-market) | **Replace** — structural keys in code, copy in `packages/i18n` |
| Web pages | **Rewrite** — English via catalogs, new scoping surface |
| `apps/mobile` | **Deleted** — its screens targeted a removed data model. A native client, if it returns, is a rebuild against the quest API |
| `stress`, `budget`, `guests` as standalone modules | **Remove** — folded into quests / cross-cutting |

Database has no real users. Migration strategy is a **hard cut**: drop and regenerate rather
than write reversible data migrations.

---

## 2. Data Model

### 2.1 Entity relationships

```
users ──< wedding_members >── weddings
                                 │
                                 ├──< couple_profiles        (1:1, semantic memory)
                                 ├──< decisions              (episodic memory, append-only)
                                 ├──< moments                (generated narrative)
                                 ├──< agent_runs ──< agent_spans   (traces)
                                 │
                                 └──< quests
                                        ├──< quest_scopings  (conversation + outcome)
                                        ├──< task_proposals  (pending, pre-commit)
                                        └──< sub_quests
                                               └──< tasks
                                                      ├──< task_photos
                                                      └──< task_vendors
```

### 2.2 Schema (Drizzle)

```ts
// ─── Wedding ──────────────────────────────────────────────────
export const weddings = pgTable('weddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingDate: date('wedding_date'),
  dateIsFlexible: boolean('date_is_flexible').default(false),

  // US market
  state: char('state', { length: 2 }),
  city: text('city'),
  currency: text('currency').notNull().default('USD'),
  cultures: text('cultures').array().notNull().default(sql`'{}'`),
  weddingType: weddingTypeEnum('wedding_type').default('traditional'),

  guestCountExact: integer('guest_count_exact'),
  guestCountRange: guestCountRangeEnum('guest_count_range'),
  budgetTotalCents: bigint('budget_total_cents', { mode: 'number' }),
  budgetTier: budgetTierEnum('budget_tier'),

  // The elastic dial for scheduling (PRD §5)
  weeklyCapacityHours: integer('weekly_capacity_hours').notNull().default(5),

  hasPlanner: boolean('has_planner').default(false),
  plannerType: plannerTypeEnum('planner_type'),   // full | partial | day_of | none
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Semantic memory ──────────────────────────────────────────
export const coupleProfiles = pgTable('couple_profiles', {
  weddingId: uuid('wedding_id').references(() => weddings.id).primaryKey(),
  styleKeywords: text('style_keywords').array().default(sql`'{}'`),
  budgetPosture: text('budget_posture'),        // value-conscious | balanced | splurge
  decisionStyle: text('decision_style'),        // has-opinions | wants-options | wants-led
  familyDynamics: text('family_dynamics'),
  hardConstraints: jsonb('hard_constraints').$type<string[]>().default([]),
  ruledOut: jsonb('ruled_out').$type<{ item: string; reason: string; at: string }[]>().default([]),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Episodic memory — append-only, never UPDATE, never DELETE ─
export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').references(() => weddings.id).notNull(),
  questKey: text('quest_key').notNull(),
  questionKey: text('question_key').notNull(),
  questionText: text('question_text').notNull(),
  choice: text('choice').notNull(),
  reason: text('reason'),                                   // the product's soul
  confidence: decisionConfidenceEnum('confidence').notNull(), // decided | assumed
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at').defaultNow(),
  supersedes: uuid('supersedes'),                           // self-ref; changed mind
  agentRunId: uuid('agent_run_id'),                         // provenance
}, t => ({
  activeIdx: index('decisions_active_idx').on(t.weddingId, t.questKey),
}))

// ─── Quests ───────────────────────────────────────────────────
export const quests = pgTable('quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').references(() => weddings.id).notNull(),
  templateKey: text('template_key').notNull(),
  i18nKey: text('i18n_key').notNull(),
  order: integer('order').notNull(),
  status: questStatusEnum('status').default('not_started'), // NO 'locked' — see PRD §3.2
  scopedAt: timestamp('scoped_at'),
  isCustom: boolean('is_custom').default(false),
  estimatedDays: integer('estimated_days'),
  suggestedDeadline: date('suggested_deadline'),
  userDeadline: date('user_deadline'),
  completedAt: timestamp('completed_at'),
})

// ─── Tasks ────────────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  subQuestId: uuid('sub_quest_id').references(() => subQuests.id).notNull(),
  templateKey: text('template_key'),
  i18nKey: text('i18n_key'),                   // NULL ⇒ user-authored, never translated
  title: text('title').notNull(),              // rendered fallback / search field

  // Provenance — what makes this agent-native (PRD §2.1)
  source: taskSourceEnum('source').notNull().default('template'), // template | ai | user
  confidence: text('confidence'),              // decided | assumed
  rationale: text('rationale'),                // why this task is on your list
  decisionId: uuid('decision_id'),             // which decision produced it

  // Scheduling (PRD §5)
  effortHours: numeric('effort_hours', { precision: 5, scale: 1 }),
  leadTimeDays: integer('lead_time_days').default(0),
  leadTimeReasonKey: text('lead_time_reason_key'),
  earliestStart: date('earliest_start'),
  latestFinish: date('latest_finish'),
  dependsOn: text('depends_on').array().default(sql`'{}'`),
  compressible: boolean('compressible').default(true),

  // Computed by the scheduler
  computedLatestStart: date('computed_latest_start'),
  slackDays: integer('slack_days'),
  onCriticalPath: boolean('on_critical_path').default(false),

  status: taskStatusEnum('status').default('todo'),
  isOptional: boolean('is_optional').default(false),
  assigneeId: uuid('assignee_id').references(() => users.id),
  rating: integer('rating'),
  notes: text('notes'),
  costCents: bigint('cost_cents', { mode: 'number' }),
  completedAt: timestamp('completed_at'),
})

// ─── Two-phase writes (PRD §7.1) ──────────────────────────────
export const taskProposals = pgTable('task_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull(),
  questKey: text('quest_key').notNull(),
  agentRunId: uuid('agent_run_id'),
  payload: jsonb('payload').$type<ProposedTask[]>().notNull(),
  rationale: text('rationale'),
  status: proposalStatusEnum('status').default('pending'), // pending|committed|discarded
  createdAt: timestamp('created_at').defaultNow(),
  committedAt: timestamp('committed_at'),
})

// ─── Observability + eval dataset (PRD §8.1) ──────────────────
export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingId: uuid('wedding_id').notNull(),
  mode: text('mode').notNull(),               // scoping | companion
  questKey: text('quest_key'),
  inputSnapshot: jsonb('input_snapshot'),     // profile + decisions at run start
  outputSnapshot: jsonb('output_snapshot'),   // committed list
  promptVersion: text('prompt_version').notNull(),
  model: text('model').notNull(),
  steps: integer('steps'), totalTokens: integer('total_tokens'),
  costCents: integer('cost_cents'), durationMs: integer('duration_ms'),
  outcome: text('outcome'),                   // committed | abandoned | error
  startedAt: timestamp('started_at').defaultNow(),
})
```

`agent_runs.inputSnapshot` + `outputSnapshot` **is** the eval dataset. Written from commit
one, before any eval tooling exists.

### 2.3 Indexes

```sql
CREATE INDEX quests_wedding_order_idx    ON quests(wedding_id, "order");
CREATE INDEX tasks_subquest_status_idx   ON tasks(sub_quest_id, status);
CREATE INDEX tasks_critical_idx          ON tasks(sub_quest_id) WHERE on_critical_path;
CREATE INDEX decisions_lookup_idx        ON decisions(wedding_id, quest_key, decided_at DESC);
CREATE INDEX agent_runs_eval_idx         ON agent_runs(outcome, started_at DESC);
```

---

## 3. Template Engine

### 3.1 Structure in code, copy in catalogs

```
apps/api/src/content/
  quests/
    index.ts                  QUEST_TEMPLATES: QuestTemplate[]
    foundation.ts  venue.ts  vendors.ts  attire.ts  … (14)
  culturePacks/
    index.ts  southAsian.ts  chinese.ts  jewish.ts  korean.ts  …
  predicates.ts               appliesWhen evaluator
  legal/marriageLicense.ts    state lookup table

packages/i18n/src/content/en/quests.json    all human-readable copy
```

### 3.2 The Resolver — pure, deterministic, no model

This is the heart of the system and it contains no AI.

```ts
export function resolveQuestTasks(
  template: QuestTemplate,
  ctx: { profile: CoupleProfile; decisions: Decision[]; wedding: Wedding },
): ResolvedTask[] {
  const answers = indexAnswers(ctx.decisions)          // questionKey → choice

  return template.taskPool
    .filter(t => t.appliesWhen.every(p => evalPredicate(p, answers, ctx)))
    .filter(t => !isRuledOut(t, ctx.profile.ruledOut))
    .filter(t => matchesWeddingType(t, ctx.wedding.weddingType))
    .concat(culturePackTasks(ctx.wedding.cultures, template.key))
    .sort(byDependencyThenOrder)
}
```

**Properties this buys:**

- Same input ⇒ byte-identical output. Unit-testable without a model.
- The rent-vs-custom divergence is demonstrable with zero AI code — the Phase 3 checkpoint
  in [PRD.md](PRD.md) §10.
- Every task carries the predicate that admitted it, which becomes the user-visible
  `rationale`.

Predicate grammar, kept intentionally small:

```
attire.dress_acquisition in (buy_offrack, buy_custom)
guest_count > 150
state == 'WA'
cultures includes 'chinese'
has_planner == false
NOT venue.type == 'all_inclusive'
```

### 3.3 CPM Scheduler — backward pass from a fixed date

```ts
export function schedule(tasks: ResolvedTask[], w: Wedding): ScheduledTask[] {
  const g = buildDAG(tasks)

  // 1. Backward pass — the wedding date is fixed, so latest-start is what matters
  for (const t of topoSort(g).reverse()) {
    const downstream = g.successors(t).map(s => s.computedLatestStart)
    const bound = min(t.latestFinish ?? w.weddingDate, ...downstream)
    t.computedLatestStart = subDays(bound, t.leadTimeDays + effortDays(t, w))
  }

  // 2. Forward pass — earliest start given dependencies and hard constraints
  for (const t of topoSort(g)) {
    const upstream = g.predecessors(t).map(p => addDays(p.earliestStart, duration(p, w)))
    t.earliestStart = max(today(), t.earliestStart ?? today(), ...upstream)
  }

  // 3. Slack. Negative ⇒ infeasible ⇒ hand the fact to the agent.
  for (const t of tasks) {
    t.slackDays = diffDays(t.computedLatestStart, t.earliestStart)
    t.onCriticalPath = t.slackDays === 0
  }
  return tasks
}

// Effort converts to calendar days through the couple's capacity — the elastic dial.
// Lead time does not convert. It is calendar time by nature.
const effortDays = (t: Task, w: Wedding) =>
  Math.ceil(t.effortHours / (w.weeklyCapacityHours / 7))
```

**Infeasibility handling.** The scheduler never resolves a negative-slack situation. It
emits a fact:

```ts
{ questKey: 'attire_beauty', worstSlackDays: -47,
  blockingTask: 'attire.alterations', leadTimeReasonKey: 'attire.lead.alterations',
  drivingDecision: { questionKey: 'attire.dress_acquisition', choice: 'buy_custom' } }
```

`drivingDecision` is what lets the agent say something actionable rather than alarming:
reopen *that* decision, show the alternative branch.

---

## 4. Agent Service

### 4.1 Harness

```
apps/api/src/agent/
  harness/  loop.ts  context.ts  dispatch.ts  guardrails.ts  trace.ts
  tools/    reads.ts  writes.ts  schemas.ts
  packs/    attire.ts  florals.ts  legal.ts … (per-quest skill packs)
  prompts/  system.md  scoping.md  companion.md   (versioned, hashed into agent_runs)
```

An agent run is **ephemeral**: created with a goal and budget, does its work, persists what
matters through tools, and is discarded. Nothing survives in process. Continuity lives in
the memory tables, which is what makes runs crash-safe, resumable, and parallelizable.

### 4.2 Context assembly — fixed order, cache-friendly

```
[System]        role, voice, hard prohibitions          ~400 tok   stable
[Skill Pack]    quest-specific prompt + tool subset     ~400 tok   stable per quest
[Profile]       full semantic memory                    ~300 tok
[Decisions]     this quest, plus cross-quest key ones   ~500 tok
[Quest Spec]    scenario, questions, pool summary       ~800 tok   stable per quest
[Timeline]      slack, blocking task, driving decision  ~100 tok
[History]       last 10 turns
                                                   total ~2.5–3k tok
```

Stable blocks come first so prompt caching covers most of every request.

### 4.3 Loop control

```ts
const STOP = {
  natural:  () => !response.toolCalls.length,
  terminal: () => calledAny(['commit_tasks']),
  budget:   () => steps > 8 || tokens > 40_000 || elapsedMs > 30_000,
  user:     () => signal.aborted,
  guard:    () => unrecoverableGuardrailError,
}
```

Budget caps are not optional. They are the only thing separating an agent from an expensive
infinite loop.

### 4.4 Two-phase writes

```
propose_tasks  → INSERT task_proposals (status: pending)  → render to user
                                                             │
                                    user edits / confirms ───┘
commit_tasks   → transaction: INSERT tasks, UPDATE proposal, INSERT decisions,
                              recompute schedule, emit activity
```

The model never writes to `tasks` directly. The confirm click is both the safety boundary
and the moment a decision becomes a memory.

### 4.5 Guardrails at dispatch

| Check | Behavior on violation |
|---|---|
| Tool not in the active skill pack's subset | Reject, return an error the model can read |
| `source: 'ai'` task without a `rationale` | Reject |
| Legal or lead-time claim not sourced from a lookup tool | Strip and re-prompt |
| `update_profile` touching a non-whitelisted field | Reject |
| Proposal exceeding 15 tasks | Reject — a wall of tasks is the failure mode being designed against |

---

## 5. API

```
POST   /onboarding                       create wedding + profile, generate quest shells
GET    /weddings/:id/board               quests + progress + timeline pressure
GET    /quests/:id                       quest + sub-quests + tasks + scoping state

# Scoping (SSE for token streaming)
POST   /quests/:id/scoping                start or resume a scoping run
POST   /quests/:id/scoping/answer         submit a choice, or defer ("you decide")
GET    /quests/:id/scoping/proposal       current pending proposal
POST   /proposals/:id/commit              commit, with optional user edits
POST   /quests/:id/scoping/skip           accept defaults, exit the loop

# Companion
POST   /weddings/:id/chat                 SSE

# Deterministic
GET    /weddings/:id/schedule             CPM output, slack, critical path, infeasibilities
PATCH  /weddings/:id/capacity             weeklyCapacityHours → triggers reschedule
PATCH  /tasks/:id                         complete, note, rating, cost, assignee
POST   /tasks/:id/photos
GET    /weddings/:id/decisions            the decision trail
GET    /weddings/:id/moments
GET    /legal/marriage-license?state=WA   lookup table
```

**Response shape — every task carries provenance:**

```jsonc
{
  "id": "…", "i18nKey": "quest.attire.task.alterations",
  "source": "template", "confidence": "decided",
  "rationale": "Included because you chose a custom gown",
  "leadTimeDays": 56, "leadTimeReasonKey": "attire.lead.alterations",
  "slackDays": -47, "onCriticalPath": true
}
```

The client renders `rationale` inline. A user who can see *why* a task is on their list can
correct the underlying decision instead of just deleting the task — and that correction is
worth far more to the system.

---

## 6. Frontend

### 6.1 Routes (`next-intl`, `en` prefix-less)

```
/                          marketing
/onboarding                6 steps + state/city + cultural traditions
/board                     all quests, no locks, pressure indicators
/quest/[key]               scenario → scoping → task list
/quest/[key]/scoping       the conversation surface
/task/[id]                 detail, photos, notes, cost, vendor
/timeline                  CPM view: critical path highlighted
/decisions                 the decision trail — becomes the memory book
/moments                   celebration cards, photo timeline
/settings                  wedding info, capacity, partner, locale
```

### 6.2 The scoping surface

The one screen that decides whether this product works.

```
┌────────────────────────────────────────────────┐
│  Attire & Beauty                               │
│  "Finding the one you'll cry over"             │  ← static, instant
│                                                │
│  Most couples spend about 6 weeks here.        │
│  Two quick questions and I'll build your list. │
├────────────────────────────────────────────────┤
│  Renting, buying off the rack, or custom?      │
│                                                │
│   [ Rent ]  [ Off the rack ]  [ Custom ]       │  ← choices, not a blank field
│   [ You decide for me → ]                      │  ← first-class, not a fallback
│                                                │
│   ▸ I have thoughts on this                    │  ← free text, collapsed
├────────────────────────────────────────────────┤
│           [ Just give me the list → ]          │  ← always available, never gated
└────────────────────────────────────────────────┘
```

Then the proposal:

```
┌────────────────────────────────────────────────┐
│  Here's your Attire list — 9 tasks             │
│  Because you chose: custom gown, 2 looks       │
│                                                │
│  ☐ Collect inspiration            2h           │
│  ☐ Book 3 salon appointments      1h           │
│  ⚠ Order the gown                 by Mar 3     │
│     Alterations take 6–8 weeks · critical path │
│  …                                             │
│                                                │
│  [ + Add ]  [ Edit ]   [ Looks good → ]        │
└────────────────────────────────────────────────┘
```

### 6.3 State

- **SWR** for board/quest/schedule reads; revalidate after any commit.
- **SSE** for scoping and chat streams.
- Proposals held in component state until committed — nothing persists to the task list
  until the user says so.
- Optimistic updates on task completion only (safe, easily reverted).

### 6.4 Motion

Framer Motion on web. Restrained: celebration on quest completion,
milestone moments, and the transition from proposal to committed list. No animation on the
scoping path — it must feel fast, not decorative.

---

## 7. Sprints

| Sprint | Scope | Exit criterion |
|---|---|---|
| **1** Foundation | Schema hard cut, types, `packages/i18n` wired (web + API), CI i18n gates | Pseudo-locale `en-XA` walk passes |
| **2** Content | 14 quests: structure, scenarios, scoping questions, tagged task pools. Culture packs for the top 3 heritages | Attire & Beauty complete end to end |
| **3** Resolver | Predicate evaluator + resolver + unit tests | **"rent" and "custom" produce two different, good lists — no AI in the codebase yet** |
| **4** Scheduler | CPM backward/forward pass, slack, capacity dial, infeasibility events | 12-month and 6-month plans differ correctly; negative slack surfaces |
| **5** Board & Quest UI | Onboarding, board, quest detail, task detail, timeline view | Full flow usable with hardcoded answers |
| **6** Agent | Harness, tools, scoping loop, two-phase writes, traces | Scoping conversation replaces hardcoded answers |
| **7** Memory & Moments | Profile write-back, decision trail UI, moment generation, celebrations | Decision trail readable as a story |
| **8** Eval & Release | Golden-path suite, LLM-as-judge for voice, CI release gate, canary | Prompt changes cannot ship without passing |

Sprint 3 is the go/no-go checkpoint for the entire product thesis, and it arrives before a
single model call is written.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Users won't answer scoping questions | Binary choices; "you decide"; list never gated. Golden-path test #5 enforces it |
| The agent produces a wall of tasks | Hard cap of 15 per proposal; pool authored so lists stay short |
| Generated lists feel generic | `rationale` on every task makes the personalization visible, not just present |
| Inconsistent advice across quests | Single agent, shared memory, serialized writes (PRD §2.3) |
| Legal errors (license waiting periods) | Lookup tables only, never model knowledge; disclaimers |
| Cost/latency of scoping | Static scenario screen; cached stable prefix; 8-step budget cap |
| Content authoring is the bottleneck | It is — Sprint 2 is the largest. Start with one quest, prove the shape, then parallelize |

---

## 9. Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Task lists generated from decisions, not pre-authored | Granularity cannot be enumerated in advance (PRD §1.2) |
| 2 | AI selects from a pool; it does not invent | Quality control, reproducibility, cheapness, translatability |
| 3 | Two-phase writes on everything | Removes the "AI changed my stuff" failure class; creates the moment |
| 4 | One agent with skill packs, not one per quest | Context fragmentation and colliding implicit decisions |
| 5 | Parallelize reads, serialize writes | Multi-agent is safe only where results are independent and mergeable |
| 6 | Structured memory, no vector store in v1 | ~200 decisions fits in context; tables are more precise and debuggable |
| 7 | Effort and lead time modeled separately | Only one of them compresses; this is why plans cannot be scaled uniformly |
| 8 | Negative slack triggers a decision reopen, not a warning | Actionable beats alarming |
| 9 | Quests never lock | People start where they're anxious; nudge instead of gate |
| 10 | Traces persisted from commit one | The eval dataset cannot be reconstructed after the fact |
