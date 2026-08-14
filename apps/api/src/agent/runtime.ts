import { and, asc, eq } from 'drizzle-orm'
import type { Culture } from '@bliss/types'
import { db } from '../db'
import {
  agentRuns,
  planningThreads,
  scheduleIssues,
  tasks,
  threadMessages,
  weddings,
} from '../db/schema'
import {
  ATTIRE_ARTIFACT_BUNDLE,
  PHOTOGRAPHER_ARTIFACT_BUNDLE,
  QUEST_SCOPING_ARTIFACT_BUNDLES,
  type AgentArtifactBundle,
} from './artifacts/registry'
import { AgentGuardrailError } from './errors'
import { runAgentLoop } from './harness/loop'
import { DatabaseTraceSink, ResilientTraceSink } from './harness/trace'
import { loadMemoryProfile } from './memory/profile'
import { createAttireTools, ATTIRE_QUEST_KEY } from './packs/attire'
import { createPhotographerTools, PHOTOGRAPHER_QUEST_KEY } from './packs/photographer'
import { createQuestScopingTools } from './packs/quest-scoping'
import type { VendorSearchProvider } from './providers/vendor-search'
import { resolveArtifactBundleForWedding } from './release/store'
import { DatabaseVendorSearchStore } from './providers/vendor-search-store'
import { DatabaseDecisionProposalStore } from './proposals/store'
import { loadCurrentDecisionState } from './proposals/current'
import type { AgentMessage, AgentModel, AgentTool } from './types'

interface DecisionRunInput {
  weddingId: string
  threadId: string
  userId: string
  signal?: AbortSignal
}

interface DecisionPack {
  questKey: string
  releaseKey: string
  goal: string
  bundle: AgentArtifactBundle
  buildTools(
    wedding: typeof weddings.$inferSelect,
    activeAnswers: Record<string, string>,
  ): AgentTool[]
}

export type QuestScopingKey = keyof typeof QUEST_SCOPING_ARTIFACT_BUNDLES

export function isQuestScopingKey(value: string): value is QuestScopingKey {
  return Object.prototype.hasOwnProperty.call(QUEST_SCOPING_ARTIFACT_BUNDLES, value)
}

export class AgentRuntime {
  constructor(private readonly model: AgentModel) {}

  async runAttireDecision(input: DecisionRunInput) {
    return this.runDecision(input, {
      questKey: ATTIRE_QUEST_KEY,
      releaseKey: ATTIRE_ARTIFACT_BUNDLE.packKey,
      goal: 'Scope the gown acquisition decision and create one Decision Packet',
      bundle: ATTIRE_ARTIFACT_BUNDLE,
      buildTools: wedding => createAttireTools({
        resolverInput: resolverInput(wedding),
        proposalStore: new DatabaseDecisionProposalStore(),
      }),
    })
  }

  async runPhotographerDecision(input: DecisionRunInput, provider: VendorSearchProvider) {
    return this.runDecision(input, {
      questKey: PHOTOGRAPHER_QUEST_KEY,
      releaseKey: PHOTOGRAPHER_ARTIFACT_BUNDLE.packKey,
      goal: 'Define photographer coverage, run one bounded search, and propose a sourced shortlist',
      bundle: PHOTOGRAPHER_ARTIFACT_BUNDLE,
      buildTools: wedding => {
        if (!wedding.city || !wedding.state) {
          throw new AgentGuardrailError(
            'WEDDING_LOCATION_REQUIRED',
            'Add the wedding city and state before searching photographers',
          )
        }
        return createPhotographerTools({
          resolverInput: resolverInput(wedding),
          weddingLocation: { city: wedding.city, state: wedding.state },
          proposalStore: new DatabaseDecisionProposalStore(),
          vendorSearch: new DatabaseVendorSearchStore(provider),
        })
      },
    })
  }

  async runQuestScopingDecision(input: DecisionRunInput, questKey: QuestScopingKey) {
    const bundle = QUEST_SCOPING_ARTIFACT_BUNDLES[questKey]
    return this.runDecision(input, {
      questKey,
      releaseKey: bundle.packKey,
      goal: `Help the couple make one grounded ${questKey} scoping decision`,
      bundle,
      buildTools: (wedding, activeAnswers) => createQuestScopingTools({
        questKey,
        resolverInput: resolverInput(wedding),
        activeAnswers,
        proposalStore: new DatabaseDecisionProposalStore(),
      }),
    })
  }

  private async runDecision(input: DecisionRunInput, pack: DecisionPack) {
    const activeBundle = await resolveArtifactBundleForWedding({
      weddingId: input.weddingId,
      packKey: pack.releaseKey,
      defaultBundle: pack.bundle,
    })
    const [thread] = await db
      .select()
      .from(planningThreads)
      .where(and(
        eq(planningThreads.id, input.threadId),
        eq(planningThreads.weddingId, input.weddingId),
      ))
      .limit(1)
    if (!thread || thread.questKey !== pack.questKey) {
      throw new AgentGuardrailError('THREAD_NOT_FOUND', 'Planning thread not found for this decision pack')
    }

    const [wedding] = await db
      .select()
      .from(weddings)
      .where(eq(weddings.id, input.weddingId))
      .limit(1)
    if (!wedding) throw new AgentGuardrailError('WEDDING_NOT_FOUND', 'Wedding not found')

    const history = await db
      .select()
      .from(threadMessages)
      .where(and(
        eq(threadMessages.threadId, input.threadId),
        eq(threadMessages.weddingId, input.weddingId),
      ))
      .orderBy(asc(threadMessages.createdAt))
    const memoryProfile = await loadMemoryProfile(input.weddingId)
    const currentDecisions = await loadCurrentDecisionState(input.weddingId)
    const schedulePressure = await db.select({
      type: scheduleIssues.type,
      severity: scheduleIssues.severity,
      taskId: scheduleIssues.taskId,
      taskKey: tasks.templateKey,
      questKey: scheduleIssues.questKey,
      slackDays: scheduleIssues.slackDays,
      weekStart: scheduleIssues.weekStart,
      overloadMinutes: scheduleIssues.overloadMinutes,
      decisionId: scheduleIssues.decisionId,
    }).from(scheduleIssues)
      .leftJoin(tasks, eq(tasks.id, scheduleIssues.taskId))
      .where(and(
        eq(scheduleIssues.weddingId, input.weddingId),
        eq(scheduleIssues.questKey, pack.questKey),
      ))
      .limit(8)
    const tools = pack.buildTools(wedding, currentDecisions.answers)

    const [run] = await db
      .insert(agentRuns)
      .values({
        weddingId: input.weddingId,
        threadId: input.threadId,
        mode: 'decision',
        goal: pack.goal,
        artifactBundleId: activeBundle.id,
        modelId: this.model.id,
        promptVersion: activeBundle.promptVersion,
        toolsVersion: activeBundle.toolsVersion,
      })
      .returning({ id: agentRuns.id, startedAt: agentRuns.startedAt })

    await db
      .update(planningThreads)
      .set({ status: 'exploring', updatedAt: new Date() })
      .where(eq(planningThreads.id, input.threadId))

    const messages: AgentMessage[] = [
      { role: 'system', content: activeBundle.prompt },
      {
        role: 'system',
        content: `Wedding context: ${JSON.stringify({
          weddingDate: wedding.weddingDate,
          city: wedding.city,
          state: wedding.state,
          weddingType: wedding.weddingType,
          cultures: wedding.cultures as Culture[],
          budgetTier: wedding.budgetTier,
          budgetMaxCents: wedding.budgetMaxCents,
          styles: wedding.styles,
          plannerType: wedding.plannerType,
        })}`,
      },
      {
        role: 'system',
        content: `Confirmed memory profile. Treat member memory as attributed, never shared by default: ${JSON.stringify(memoryProfile)}`,
      },
      {
        role: 'system',
        content: `Current confirmed decision answers: ${JSON.stringify(currentDecisions.answers)}. A new confirmed answer supersedes only the same question.`,
      },
      {
        role: 'system',
        content: `Deterministic schedule pressure for this quest: ${JSON.stringify(schedulePressure)}. Negative slack is authoritative: change or reopen the driving choice rather than claiming the calendar can compress lead time.`,
      },
      ...history.map(message => ({
        role: message.authorType === 'assistant' ? 'assistant' as const : 'user' as const,
        content: `message_id=${message.id}; author_user_id=${message.authorUserId ?? message.authorType}; content=${message.content}`,
      })),
    ]

    const loop = await runAgentLoop({
      model: this.model,
      tools,
      messages,
      context: {
        runId: run!.id,
        weddingId: input.weddingId,
        userId: input.userId,
        threadId: input.threadId,
      },
      limits: {
        maxSteps: 8,
        maxTokens: 32_000,
        maxCostMicros: 500_000,
        maxMs: 30_000,
      },
      trace: new ResilientTraceSink(
        new DatabaseTraceSink(),
        (error, runId, span) => console.error('Agent trace write failed', {
          error,
          runId,
          span: span.name,
        }),
      ),
      signal: input.signal,
    })

    const assistantText = [...loop.messages].reverse().find(message =>
      message.role === 'assistant' && message.content,
    )?.content
    if (assistantText) {
      await db.insert(threadMessages).values({
        threadId: input.threadId,
        weddingId: input.weddingId,
        authorType: 'assistant',
        content: assistantText,
        metadata: { runId: run!.id, stopReason: loop.stopReason },
      })
    }

    await db
      .update(agentRuns)
      .set({
        steps: loop.steps,
        inputTokens: loop.inputTokens,
        outputTokens: loop.outputTokens,
        costMicros: loop.costMicros,
        latencyMs: Date.now() - run!.startedAt.getTime(),
        stopReason: loop.stopReason,
        outcome: loop.stopReason === 'terminal_tool'
          ? 'proposal_created'
          : loop.stopReason === 'natural'
            ? 'completed'
            : 'failed',
        endedAt: new Date(),
      })
      .where(eq(agentRuns.id, run!.id))

    return {
      runId: run!.id,
      stopReason: loop.stopReason,
      message: assistantText ?? null,
      proposal: loop.terminalToolResult ?? null,
      usage: {
        steps: loop.steps,
        inputTokens: loop.inputTokens,
        outputTokens: loop.outputTokens,
        costMicros: loop.costMicros,
      },
    }
  }
}

function resolverInput(wedding: typeof weddings.$inferSelect) {
  return {
    weddingType: wedding.weddingType,
    cultures: wedding.cultures as Culture[],
    plannerType: wedding.plannerType,
    guestCount: wedding.guestCountExact ?? undefined,
    state: wedding.state ?? undefined,
    budgetTier: wedding.budgetTier ?? undefined,
  }
}
