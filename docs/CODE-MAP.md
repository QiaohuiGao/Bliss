# Bliss Code Map

**Purpose:** which file does which job, and which section of
[AGENTIC-SYSTEM-DESIGN.md](AGENTIC-SYSTEM-DESIGN.md) it implements.

Read this when you know *what* you want to change but not *where* it lives.

---

## 0. The one-paragraph orientation

Bliss is a Bun + TypeScript monorepo with three workspaces: `apps/api` (Fastify, where
essentially all the logic lives), `apps/web` (Next.js), and `packages/*` (shared types,
i18n catalogs, config).

Inside `apps/api/src` there are **four kinds of code**, and telling them apart is the
single most useful thing to internalize:

| Directory | Kind of code | Contains a model call? |
|---|---|---|
| `content/` | authored wedding knowledge + a tiny predicate language | no |
| `services/` | deterministic domain math (resolve, schedule, generate) | no |
| `agent/` | the agentic system: harness, tools, memory, evals, release | yes, in one place |
| `routes/` | HTTP surface that wires the three together | no |

Design §2.3 rule 1 is the reason for this split: *if an answer is computable, ordinary code
computes it.* `content/` and `services/` are the computable part, and they are the majority
of the value. `agent/` exists only for the questions that have no correct answer.

---

## 1. Suggested reading order

If you want to understand the whole system, read in this order. Nine files, roughly two
hours, and you will have the real shape.

| # | File | Why this one |
|---|---|---|
| 1 | `content/predicates.ts` | the smallest complete idea in the codebase: tasks are a pure function of decisions |
| 2 | `services/quest-resolver.ts` | that idea applied to the whole content tree |
| 3 | `agent/types.ts` | the Decision Packet contract — the system's atomic unit |
| 4 | `agent/harness/loop.ts` | the bounded loop; the entire "agent" is 196 lines |
| 5 | `agent/packs/attire.ts` | one domain pack: tool definitions + the prompt |
| 6 | `agent/runtime.ts` | context assembly: what the model actually sees |
| 7 | `agent/proposals/committer.ts` | the commit boundary, where a proposal becomes real |
| 8 | `agent/evals/run-suite.ts` | how the release gate judges a bundle |
| 9 | `routes/agent.ts` | how a browser request reaches all of the above |

**The two most important files** are #4 and #7. `loop.ts` is the agent; `committer.ts` is
the reason the agent can't damage anything.

---

## 2. `apps/api/src/content/` — authored knowledge

Design §8.1. No model, no database, no I/O. Pure data plus a validator.

| File | Lines | Job |
|---|---:|---|
| `quest-templates.ts` | 2002 | the 14 base quests: sections, tasks, `appliesWhen` tags, scoping questions, lead times |
| `culture-packs.ts` | 607 | cultural add-ons that graft extra sections onto base quests |
| `predicates.ts` | 205 | the predicate mini-language (`attire.dress_acquisition == rent`), parser + evaluator |
| `marriage-license.ts` | — | per-state license rules; feeds the legal authority provider |
| `validate-content.ts` | 210 | static self-check: undeclared answer keys, defaults outside options, questions no task reads, prerequisite order |

**`validate-content.ts` is worth understanding early.** Every failure it catches is
otherwise *silent in production*: a typo'd answer key means a predicate never matches, so
the task quietly vanishes from every couple's list and nobody finds out. It runs in `bun
test` and therefore in CI.

---

## 3. `apps/api/src/services/` — deterministic domain core

Design §8.1–8.2. This is the layer that existed before the agent and still carries most of
the product's correctness.

| File | Lines | Job |
|---|---:|---|
| `quest-resolver.ts` | 232 | prune the quest tree by wedding type, graft culture packs, filter tasks by predicate, fill unanswered questions from defaults |
| `quest-generator.ts` | 182 | write a resolved tree into `modules` / `sub_modules` / `tasks` with i18n keys |
| `schedule-engine.ts` | 205 | dependency backward pass for latest safe start dates, plus weekly workload aggregation |
| `schedule-store.ts` | 112 | persist schedule issues (negative slack, overloaded weeks) |
| `couple-workspace.ts` | 101 | two members sharing one `wedding_id` (design §3) |

**Note the deliberate split in `schedule-engine.ts`** (design §8.2): deadlines and workload
are two separate calculations. Per-task durations do not enforce shared weekly capacity, so
pretending one number does both would be a lie about accuracy.

`quest-resolver.ts` is *also* an agent tool — see §4.3 below. Same code, two callers.

---

## 4. `apps/api/src/agent/` — the agentic system

8600 lines. This is the part that maps onto the seven-layer reference, so the subsections
below follow the design doc's layer numbering rather than alphabetical order.

### 4.1 `types.ts` (305 lines) — the contracts

Design §4. The `DecisionPacket` zod schema plus `AgentTool`, `AgentModel`,
`AgentMessage`, `AgentSpanRecord`. **Start here, not at the loop.** Almost every guardrail
in the system is a zod refinement in this file, which means violations are rejected at the
tool boundary rather than caught later.

### 4.2 `harness/` — layer ② the runtime

| File | Lines | Job |
|---|---:|---|
| `loop.ts` | 196 | the bounded loop: call model → validate tool request → dispatch → append result → repeat until a stop condition (design §5.5) |
| `trace.ts` | — | `DatabaseTraceSink` and `ResilientTraceSink`; the latter is why an unavailable telemetry backend cannot break a user's run (design §13.5) |
| `trace-sanitize.ts` | 101 | redaction before a span is persisted (design §13.3) |

The loop takes `model`, `tools`, `messages`, `limits`, `trace` and returns a stop reason.
It knows nothing about weddings. That is the point: everything wedding-specific arrives
through `tools` and `messages`.

### 4.3 `packs/` — layer ④ domain packs

Design §5.1, §9.1. A pack is *tool definitions + a prompt*, nothing more. One shared
runtime, three packs (design decision #1: no separate agents).

| File | Lines | Job |
|---|---:|---|
| `attire.ts` | 211 | the gown decision: `get_candidate_tasks`, `propose_decision` |
| `photographer.ts` | 220 | adds `search_photographers`; the only pack with an external read |
| `quest-scoping.ts` | 227 | the generic pack driving the other 12 quests: `get_scoping_questions` + `get_candidate_tasks` |
| `voice.ts` | — | the voice contract as a versioned prompt artifact, composed into active bundles |

**The model-callable tool surface is four tools total**, all read-or-propose. There is no
write tool. `get_candidate_tasks` is where `services/quest-resolver.ts` re-enters as a
tool: the resolver returns a large candidate pool, and the model selects ≤8 with reasons.
The pool being large and the proposal being small are both correct — they are different
roles.

`voice.ts` holds `VOICE_DO` / `VOICE_NEVER` verbatim from [VOICE.md](VOICE.md) and the
prompt text built from them. It exists so warmth is enforced by CI rather than living in a
document nothing imports.

### 4.4 `proposals/` — the commit boundary

Design §4.1. **The most important directory in the repo.**

| File | Lines | Job |
|---|---:|---|
| `committer.ts` | 476 | one transaction: append decision → materialize tasks → apply memory claims → create action drafts → create moment draft → recompute schedule |
| `store.ts` | 198 | persist and version a packet awaiting review |
| `current.ts` / `current-state.ts` | 190 | what has already been decided in this thread, so a run does not re-ask |

`committer.ts` is plain application code called by an HTTP endpoint. `commit_decision` is
deliberately **not** an agent tool — the model has no path to canonical state. It also
refuses to confirm a `contested` packet, which is how "the assistant never picks a side"
becomes a database-level fact instead of a prompt instruction.

### 4.5 `memory/` — layer ⑤

Design §6.

| File | Job |
|---|---|
| `profile.ts` | load the semantic memory projection for a run |
| `projection.ts` | recompute the profile summary from active claims |
| `corrections.ts` | supersede a claim instead of overwriting it |
| `assets.ts` / `media-cleanup.ts` | moment assets and orphaned-upload cleanup |

The source of truth is evidence-backed claims in `memory_claims`; the profile is a
**projection** that can be rebuilt. That is what makes an AI inference correctable — you
can trace any statement back to the message that produced it.

### 4.6 `models/` — layer ③

| File | Job |
|---|---|
| `anthropic.ts` | Claude adapter: messages, tool schemas, usage accounting |
| `gemini.ts` | second provider behind the same `AgentModel` interface |
| `configured.ts` | pick a provider from env; returns null when unconfigured so routes can answer 503 |

The loop depends only on the `AgentModel` interface, so provider choice never reaches
prompts or traces.

### 4.7 `providers/` — layer ④ external adapters

| File | Job |
|---|---|
| `vendor-search.ts` / `vendor-search-store.ts` | bounded vendor search, results persisted as candidates |
| `email-send.ts` | the approved-write worker path |
| `legal-authority.ts` | the *only* legitimate source of license rules (design §8.3) |
| `media-upload.ts` | single-use scoped PUT grants, private bucket, short-lived GET |

Design §9: vendor pages and uploaded documents are **untrusted data, never instructions**.

### 4.8 `actions/` — external-action lifecycle

Design §9.3.

| File | Job |
|---|---|
| `contracts.ts` | payload schemas per action kind (email, calendar, reminder, shortlist) |
| `approver.ts` | exact-payload approval; transitions `draft → approved` |
| `action-worker.ts` | renewable lease claim, provider idempotency key, bounded backoff |
| `reminder-worker.ts` | scheduled reminder delivery |

Read `action-worker.ts` if you want the sharpest code in the repo: an expired lease is
recoverable after a crash, and an ambiguous provider response is never guessed into
success.

### 4.9 `ops/`, `release/`, `artifacts/` — layers ⑥ and ⑦

| File | Lines | Job |
|---|---:|---|
| `artifacts/registry.ts` | 157 | every immutable bundle: prompt + tools + policy + eval suite versions (design §14.3) |
| `release/store.ts` | 207 | which bundle a wedding gets; rollback to last known good |
| `release/cohort.ts` | — | wedding-sticky assignment, so both partners see one Bliss (design §14.4) |
| `ops/store.ts`, `ops/summary.ts` | 111 | run/span persistence and the metrics rollup behind `routes/ops.ts` |

### 4.10 `evals/` — the release gate

Design §14.1–14.2. **Read the caveat below before trusting a PASS.**

| File | Job |
|---|---|
| `run-suite.ts` (448) | the runner: prompt regex checks + scripted-model case execution |
| `release-gate.ts` | the CI entry point (`bun run eval:agent`); fails the build on any failure |
| `attire-suite.ts`, `photographer-suite.ts`, `*-scoping-suite.ts` (×12) | authored cases per pack |

**What this layer actually tests:** `ScriptedEvalModel` in `run-suite.ts` replays a
hardcoded sequence of tool calls. No language model is invoked. So the suites verify the
**harness** — stop conditions, guardrail rejections, packet schema validity, contested
handling, budget exhaustion — plus regex assertions that required policies are present in
the prompt artifact.

**What it does not test:** anything about model behavior — tone, question quality,
whether a recommendation actually fits. Those need a real model and a scored judge, and
neither exists yet. Design §14.2's calibrated quality judge is specified, not built.

---

## 5. `apps/api/src/routes/` and `db/`

### Routes (design §12)

| File | Lines | Job |
|---|---:|---|
| `agent.ts` | 348 | threads, messages, decision runs per pack, proposal read/patch/confirm/defer |
| `weddings.ts` | 315 | onboarding, members, invitations, dashboard |
| `tasks.ts` | 276 | task state, photos, vendors |
| `modules.ts` | 243 | quest and section reads |
| `memory.ts` | 198 | inspect and correct memory claims |
| `actions.ts` | 101 | external-action approve / cancel |
| `uploads.ts` | 124 | upload grants |
| `legal.ts` | 94 | license lookups |
| `ops.ts`, `feedback.ts`, `celebrations.ts`, `auth.ts` | — | telemetry summary, feedback events, celebrations, Clerk auth |

Every wedding-scoped handler checks membership before touching data (design §15.2).

### Schema (design §11)

`db/schema/agent.ts` (407 lines) is the new world: `planning_threads`, `thread_messages`,
`decision_proposals`, `decisions`, `memory_claims`, `moments`, `moment_assets`,
`external_actions`, `agent_runs`, `agent_spans`, `agent_feedback`,
`agent_artifact_bundles`, `agent_deployments`, `idempotency_records`, `vendor_searches`,
`schedule_issues`.

`weddings.ts`, `users.ts`, `tasks.ts`, `modules.ts`, `activity.ts`, `celebrations.ts` are
the original checklist tables, still in use.

---

## 6. `apps/web/` — two surfaces, on purpose

| Path | What it is |
|---|---|
| `app/[locale]/v2/**` | the Decision Packet surface: threads, plan, approvals, memory, moments |
| `components/v2/**` | `DecisionPacket.tsx`, attribution helpers, `data.ts` (all v2 API access) |
| `app/[locale]/{board,dashboard,quest,onboarding}` | the original checklist surface |
| `app/[locale]/assistant/**` | earlier agent-run pages |
| `lib/api.ts` | shared typed client for both surfaces |

`v2/` is a new presentation of the same API contract, not a fork of the backend —
`components/v2/data.ts` reuses `lib/api.ts` unchanged.

---

## 7. `packages/` and scripts

| Path | Job |
|---|---|
| `packages/types` | shared contracts between API and web |
| `packages/i18n` | ICU catalogs; `lint:i18n` enforces parity in CI |
| `packages/config` | shared tsconfig / tooling |
| `apps/api/scripts/smoke-*.ts` | manual end-to-end checks against a running stack (agent runs, release rollback, model provider, couple workspace) |
| `apps/api/scripts/verify-generation.ts` | run content validation plus a real generation pass |
| `.github/workflows/ci.yml` | i18n → type-check → test → `eval:agent` → build |

---

## 8. Where to make a given change

| I want to… | Touch |
|---|---|
| add or fix a wedding task | `content/quest-templates.ts`, then `bun test` |
| add a branch that changes the task list | add a scoping question + `appliesWhen` tags in `content/`; nothing in `agent/` |
| change what the assistant *sounds* like | `packs/voice.ts` and `docs/VOICE.md` together |
| change what the assistant may *do* | the pack's tool list in `packs/`, plus `types.ts` if the packet shape changes |
| change what happens on confirm | `proposals/committer.ts` |
| add an external integration | `providers/` + `actions/contracts.ts` + an approval policy |
| ship a prompt change | add a new bundle in `artifacts/registry.ts`; never edit a released one |
| add a safety invariant | prefer a zod refinement in `types.ts` or a check in `committer.ts` over a prompt rule |

**The last row is the habit worth forming.** A rule in a prompt is a request; a rule in
`types.ts` or `committer.ts` is a fact.
