import { and, eq, inArray, isNull } from 'drizzle-orm'
import { translate } from '@bliss/i18n'
import type { Culture } from '@bliss/types'
import { db, type DB } from '../../db'
import {
  decisionProposals,
  decisionProposalApprovals,
  decisions,
  externalActions,
  idempotencyRecords,
  memoryClaims,
  modules,
  moments,
  planningThreads,
  subModules,
  tasks,
  threadMessages,
  vendorShortlistItems,
  weddingMembers,
  weddings,
} from '../../db/schema'
import { sectionI18nKey, taskI18nKey } from '../../content/quest-templates'
import { QUEST_TEMPLATES } from '../../content/quest-templates'
import { referencedAnswerKeys } from '../../content/predicates'
import { resolveTree } from '../../services/quest-resolver'
import { AgentGuardrailError } from '../errors'
import { recomputeWeddingSchedule } from '../../services/schedule-store'
import { loadCurrentDecisionState } from './current'
import { citedMessageIds, unresolvedCitations } from './evidence'
import { planClaimWrite } from '../memory/write-policy'

export interface CommitDecisionResult {
  proposalId: string
  decisionId: string
  taskIds: string[]
  memoryClaimIds: string[]
  externalActionIds: string[]
  momentId: string | null
  vendorShortlistItemIds: string[]
  replayed: boolean
}

export interface DecisionCommitter {
  confirm(input: {
    proposalId: string
    weddingId: string
    userId: string
    idempotencyKey: string
    locale?: string
  }): Promise<CommitDecisionResult>
}

type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0]

async function assertMembership(tx: Transaction, weddingId: string, userId: string) {
  const [membership] = await tx
    .select({ id: weddingMembers.id })
    .from(weddingMembers)
    .where(and(
      eq(weddingMembers.weddingId, weddingId),
      eq(weddingMembers.userId, userId),
    ))
    .limit(1)
  if (!membership) {
    throw new AgentGuardrailError('WEDDING_ACCESS_DENIED', 'User is not a member of this wedding')
  }
}

export class DatabaseDecisionCommitter implements DecisionCommitter {
  async confirm(input: {
    proposalId: string
    weddingId: string
    userId: string
    idempotencyKey: string
    locale?: string
  }): Promise<CommitDecisionResult> {
    if (!input.idempotencyKey.trim()) {
      throw new AgentGuardrailError('IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key is required')
    }

    const result = await db.transaction(async tx => {
      await assertMembership(tx, input.weddingId, input.userId)

      const operation = `confirm_decision:${input.proposalId}`
      const [reservation] = await tx
        .insert(idempotencyRecords)
        .values({
          weddingId: input.weddingId,
          operation,
          key: input.idempotencyKey,
        })
        .onConflictDoNothing()
        .returning({ id: idempotencyRecords.id })

      if (!reservation) {
        const [existing] = await tx
          .select({ response: idempotencyRecords.response })
          .from(idempotencyRecords)
          .where(and(
            eq(idempotencyRecords.weddingId, input.weddingId),
            eq(idempotencyRecords.operation, operation),
            eq(idempotencyRecords.key, input.idempotencyKey),
          ))
          .limit(1)
        if (!existing?.response) {
          throw new AgentGuardrailError('IDEMPOTENCY_IN_PROGRESS', 'This confirmation is still in progress', true)
        }
        return { ...(existing.response as Omit<CommitDecisionResult, 'replayed'>), replayed: true }
      }

      // Serialize every confirmation for this wedding before reading mutable
      // proposal state. This covers simultaneous requests that use different
      // idempotency keys as well as choices that affect cross-quest predicates.
      const [wedding] = await tx
        .select()
        .from(weddings)
        .where(eq(weddings.id, input.weddingId))
        .limit(1)
        .for('update')
      if (!wedding) throw new AgentGuardrailError('WEDDING_NOT_FOUND', 'Wedding not found')

      const [proposal] = await tx
        .select()
        .from(decisionProposals)
        .where(and(
          eq(decisionProposals.id, input.proposalId),
          eq(decisionProposals.weddingId, input.weddingId),
        ))
        .limit(1)

      if (!proposal) throw new AgentGuardrailError('PROPOSAL_NOT_FOUND', 'Decision proposal not found')
      if (proposal.status !== 'pending') {
        throw new AgentGuardrailError('PROPOSAL_NOT_PENDING', 'Only a pending proposal can be confirmed')
      }
      if (proposal.state === 'contested') {
        throw new AgentGuardrailError('PROPOSAL_CONTESTED', 'Resolve the contested decision before confirming it')
      }
      if (!proposal.proposedChoice) {
        throw new AgentGuardrailError('PROPOSAL_CHOICE_REQUIRED', 'A ready proposal must contain a choice')
      }
      if (proposal.proposedChoice === 'other' && !proposal.customChoice) {
        throw new AgentGuardrailError('CUSTOM_CHOICE_REQUIRED', 'Other requires the couple\'s own choice')
      }
      if (proposal.proposedChoice !== 'other' && proposal.customChoice) {
        throw new AgentGuardrailError('UNEXPECTED_CUSTOM_CHOICE', 'Authored choices must not include custom choice text')
      }

      const [requiredMembers, readyMembers] = await Promise.all([
        tx.select({ userId: weddingMembers.userId })
          .from(weddingMembers)
          .where(eq(weddingMembers.weddingId, input.weddingId)),
        tx.select({ userId: decisionProposalApprovals.userId })
          .from(decisionProposalApprovals)
          .where(and(
            eq(decisionProposalApprovals.weddingId, input.weddingId),
            eq(decisionProposalApprovals.proposalId, proposal.id),
          )),
      ])
      const readyMemberIds = new Set(readyMembers.map(member => member.userId))
      if (requiredMembers.length === 0 || requiredMembers.some(member => !readyMemberIds.has(member.userId))) {
        throw new AgentGuardrailError(
          'MEMBER_APPROVALS_REQUIRED',
          'Every joined wedding member must approve this proposal before it can be confirmed',
        )
      }

      // Canonical decision writes are serialized by the wedding row lock above.
      // Build one active answer per question so changing one choice preserves all
      // other confirmed choices, including predicates that cross quest boundaries.
      const currentDecisions = await loadCurrentDecisionState(input.weddingId, tx)
      const supersededDecision = currentDecisions.byQuestion.get(proposal.questionKey)
      const activeAnswers = { ...currentDecisions.answers }
      const authoredQuest = QUEST_TEMPLATES.find(template => template.key === proposal.questKey)
      const authoredQuestion = authoredQuest?.scopingQuestions?.find(question => (
        `${authoredQuest.answerNamespace ?? authoredQuest.key}.${question.key}` === proposal.questionKey
      ))
      activeAnswers[proposal.questionKey] = proposal.proposedChoice === 'other'
        ? authoredQuestion?.defaultValue ?? proposal.proposedChoice
        : proposal.proposedChoice

      // Resolve every cited message before writing anything. A fabricated citation
      // passes schema validation and is indistinguishable from a real one once
      // stored, which would destroy the one affordance that makes a wrong inference
      // correctable. Scoped to this thread as well as this wedding: evidence for a
      // decision has to come from the conversation that produced it.
      const citedIds = citedMessageIds(proposal)
      if (citedIds.length > 0) {
        const knownMessages = await tx
          .select({ id: threadMessages.id })
          .from(threadMessages)
          .where(and(
            eq(threadMessages.weddingId, input.weddingId),
            eq(threadMessages.threadId, proposal.threadId),
            inArray(threadMessages.id, citedIds),
          ))
        const unresolved = unresolvedCitations(proposal, knownMessages.map(message => message.id))
        if (unresolved.length > 0) {
          throw new AgentGuardrailError('EVIDENCE_NOT_FOUND', unresolved.join('; '))
        }
      }

      const [decision] = await tx
        .insert(decisions)
        .values({
          weddingId: input.weddingId,
          threadId: proposal.threadId,
          questKey: proposal.questKey,
          questionKey: proposal.questionKey,
          choice: proposal.proposedChoice,
          customChoice: proposal.customChoice,
          reason: proposal.reason,
          decidedBy: requiredMembers.length > 1 ? 'both' : 'member',
          confidence: proposal.reason ? 'high' : 'medium',
          wasContested: false,
          proposalId: proposal.id,
          supersedesId: supersededDecision?.id ?? null,
        })
        .returning({ id: decisions.id })

      const taskIds: string[] = []
      const isAuthoredScopingQuestion = authoredQuest?.scopingQuestions?.some(question =>
        `${authoredQuest.answerNamespace ?? authoredQuest.key}.${question.key}` === proposal.questionKey,
      ) ?? false
      // Reconcile the branch even when the chosen answer intentionally creates
      // zero tasks (for example a dry bar or no dessert). Otherwise obsolete
      // tasks from the old/default branch would survive the decision.
      if (proposal.taskEffects.length > 0 || isAuthoredScopingQuestion) {
        const [questModule] = await tx
          .select()
          .from(modules)
          .where(and(
            eq(modules.weddingId, input.weddingId),
            eq(modules.templateKey, proposal.questKey),
          ))
          .limit(1)
        if (!questModule) {
          throw new AgentGuardrailError('QUEST_MODULE_NOT_FOUND', 'The quest has not been generated for this wedding')
        }

        const resolved = resolveTree({
          weddingType: wedding.weddingType,
          cultures: wedding.cultures as Culture[],
          plannerType: wedding.plannerType,
          guestCount: wedding.guestCountExact ?? undefined,
          state: wedding.state ?? undefined,
          budgetTier: wedding.budgetTier ?? undefined,
          answers: activeAnswers,
        }).quests.find(quest => quest.template.key === proposal.questKey)
        if (!resolved) throw new AgentGuardrailError('QUEST_NOT_RESOLVED', 'The confirmed choice produced no quest')

        const templatesByKey = new Map(resolved.sections.flatMap(({ section }) =>
          section.tasks.map(task => [task.key, { section, task }] as const),
        ))

        // Onboarding creates a useful assumed plan. Once the couple decides,
        // remove only unfinished assumed tasks from branches that now conflict.
        const validTaskKeys = new Set(templatesByKey.keys())
        const controlledAuthoredTasks = authoredQuest?.sections.flatMap(section => {
          const sectionControlled = section.appliesWhen?.some(predicate =>
            referencedAnswerKeys(predicate).includes(proposal.questionKey),
          ) ?? false
          return section.tasks.filter(task => sectionControlled || task.appliesWhen?.some(predicate =>
            referencedAnswerKeys(predicate).includes(proposal.questionKey),
          ))
        }) ?? []
        const controlledTaskKeys = new Set(controlledAuthoredTasks.map(task => task.key))
        const invalidControlledTaskKeys = controlledAuthoredTasks
          .map(task => task.key)
          .filter(taskKey => !validTaskKeys.has(taskKey))
        if (invalidControlledTaskKeys.length > 0) {
          const questSections = await tx
            .select({ id: subModules.id })
            .from(subModules)
            .where(eq(subModules.moduleId, questModule.id))
          if (questSections.length > 0) {
            await tx
              .delete(tasks)
              .where(and(
                eq(tasks.weddingId, input.weddingId),
                eq(tasks.status, 'todo'),
                inArray(tasks.subModuleId, questSections.map(section => section.id)),
                inArray(tasks.templateKey, invalidControlledTaskKeys),
              ))
          }
        }

        // A section may itself be conditional. Remove a now-empty obsolete
        // section, but preserve it when it still contains completed history.
        const validSectionKeys = new Set(resolved.sections.map(({ section }) => section.key))
        const invalidControlledSections = authoredQuest?.sections.filter(section =>
          !validSectionKeys.has(section.key)
          && (section.appliesWhen?.some(predicate =>
            referencedAnswerKeys(predicate).includes(proposal.questionKey),
          ) ?? false),
        ) ?? []
        for (const authoredSection of invalidControlledSections) {
          const sectionKey = sectionI18nKey(proposal.questKey, authoredSection.key)
          const [existingSection] = await tx
            .select({ id: subModules.id })
            .from(subModules)
            .where(and(
              eq(subModules.moduleId, questModule.id),
              eq(subModules.i18nKey, sectionKey),
            ))
            .limit(1)
          if (!existingSection) continue
          const [remainingTask] = await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(eq(tasks.subModuleId, existingSection.id))
            .limit(1)
          if (!remainingTask) {
            await tx.delete(subModules).where(eq(subModules.id, existingSection.id))
          }
        }

        // The packet previews the most important effects, but the deterministic
        // core owns completeness. Materialize every authored task in the valid
        // branch, then include any explicitly proposed base task as well.
        const effectsByTaskKey = new Map(proposal.taskEffects.map(effect => [effect.taskKey, effect]))
        for (const taskKey of validTaskKeys) {
          if (!controlledTaskKeys.has(taskKey) || effectsByTaskKey.has(taskKey)) continue
          effectsByTaskKey.set(taskKey, {
            taskKey,
            rationale: proposal.reason ?? proposal.summary,
          })
        }

        for (const effect of effectsByTaskKey.values()) {
          const found = templatesByKey.get(effect.taskKey)
          if (!found) {
            throw new AgentGuardrailError('TASK_NOT_IN_CONFIRMED_BRANCH', `Task ${effect.taskKey} is not valid for this choice`)
          }
          const sectionKey = sectionI18nKey(proposal.questKey, found.section.key)
          let [section] = await tx
            .select({ id: subModules.id })
            .from(subModules)
            .where(and(
              eq(subModules.moduleId, questModule.id),
              eq(subModules.i18nKey, sectionKey),
            ))
            .limit(1)
          if (!section) {
            const resolvedSectionIndex = resolved.sections.findIndex(
              item => item.section.key === found.section.key,
            )
            const [createdSection] = await tx
              .insert(subModules)
              .values({
                moduleId: questModule.id,
                i18nKey: sectionKey,
                title: translate(input.locale ?? 'en', sectionKey),
                sortOrder: resolvedSectionIndex + 1,
                isOptional: found.section.isOptional,
              })
              .returning({ id: subModules.id })
            section = createdSection
          }
          if (!section) throw new AgentGuardrailError('QUEST_SECTION_CREATE_FAILED', `Section ${found.section.key} could not be created`)

          const i18nKey = taskI18nKey(proposal.questKey, effect.taskKey)
          const descriptionKey = `${i18nKey}.description`
          const translatedDescription = translate(input.locale ?? 'en', descriptionKey)
          const description = translatedDescription === descriptionKey ? null : translatedDescription
          const [existing] = await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(and(
              eq(tasks.subModuleId, section.id),
              eq(tasks.templateKey, effect.taskKey),
            ))
            .limit(1)
          if (existing) {
            await tx
              .update(tasks)
              .set({
                i18nKey,
                title: translate(input.locale ?? 'en', `${i18nKey}.title`),
                description,
                source: 'template',
                confidence: 'decided',
                rationale: effect.rationale,
                decisionId: decision!.id,
                isOptional: found.task.isOptional,
                leadTimeDays: found.task.leadTimeDays ?? null,
                effortMinutes: found.task.effortMinutes ?? 60,
                costCategory: found.task.costCategory ?? null,
              })
              .where(eq(tasks.id, existing.id))
            taskIds.push(existing.id)
            continue
          }

          const [created] = await tx.insert(tasks).values({
              subModuleId: section.id,
              weddingId: input.weddingId,
              templateKey: effect.taskKey,
              i18nKey,
              title: translate(input.locale ?? 'en', `${i18nKey}.title`),
              description,
              sortOrder: found.section.tasks.findIndex(task => task.key === effect.taskKey) + 1,
              source: 'template',
              confidence: 'decided',
              rationale: effect.rationale,
              decisionId: decision!.id,
              isOptional: found.task.isOptional,
              dueDate: questModule.suggestedDeadline,
              leadTimeDays: found.task.leadTimeDays ?? null,
              effortMinutes: found.task.effortMinutes ?? 60,
              costCategory: found.task.costCategory ?? null,
            })
            .returning({ id: tasks.id })
          taskIds.push(created!.id)
        }
      }

      const memoryClaimIds: string[] = []
      if (proposal.memoryEffects.length > 0) {
        for (const effect of proposal.memoryEffects) {
          const [current] = await tx
            .select({ id: memoryClaims.id })
            .from(memoryClaims)
            .where(and(
              eq(memoryClaims.weddingId, input.weddingId),
              eq(memoryClaims.subjectType, effect.subjectType),
              effect.subjectId
                ? eq(memoryClaims.subjectId, effect.subjectId)
                : isNull(memoryClaims.subjectId),
              eq(memoryClaims.key, effect.key),
              eq(memoryClaims.status, 'confirmed'),
            ))
            .limit(1)
          const claimPlan = planClaimWrite(effect.source)
          if (current && claimPlan.supersedesCurrent) {
            await tx
              .update(memoryClaims)
              .set({ status: 'superseded' })
              .where(eq(memoryClaims.id, current.id))
          }
          const [created] = await tx.insert(memoryClaims).values({
            weddingId: input.weddingId,
            decisionId: decision!.id,
            subjectType: effect.subjectType,
            subjectId: effect.subjectId,
            kind: effect.kind,
            key: effect.key,
            value: effect.value,
            source: effect.source,
            confidenceBasisPoints: effect.confidenceBasisPoints,
            status: claimPlan.status,
            evidenceMessageIds: effect.evidenceMessageIds,
            createdBy: input.userId,
            supersedesId: claimPlan.supersedesCurrent ? current?.id ?? null : null,
          }).returning({ id: memoryClaims.id })
          memoryClaimIds.push(created!.id)
        }
      }

      const externalActionIds: string[] = []
      if (proposal.externalActions.length > 0) {
        const rows = await tx
          .insert(externalActions)
          .values(proposal.externalActions.map(action => ({
            weddingId: input.weddingId,
            decisionId: decision!.id,
            kind: action.kind,
            payload: action.payload,
            status: 'draft' as const,
          })))
          .returning({ id: externalActions.id })
        externalActionIds.push(...rows.map(row => row.id))
      }

      let momentId: string | null = null
      if (proposal.momentCandidate) {
        const [created] = await tx
          .insert(moments)
          .values({
            weddingId: input.weddingId,
            decisionId: decision!.id,
            title: proposal.momentCandidate.title,
            narrative: proposal.momentCandidate.narrative,
            sourceMessageIds: proposal.momentCandidate.sourceMessageIds,
            createdByAgentRunId: proposal.agentRunId,
          })
          .returning({ id: moments.id })
        momentId = created!.id
      }

      const vendorShortlistItemIds: string[] = []
      if (proposal.vendorEffects.length > 0) {
        const rows = await tx.insert(vendorShortlistItems).values(
          proposal.vendorEffects.map((vendor, index) => ({
            weddingId: input.weddingId,
            decisionId: decision!.id,
            candidateId: vendor.candidateId,
            rank: index + 1,
            rationale: vendor.rationale,
            pros: vendor.pros,
            concerns: vendor.concerns,
          })),
        ).returning({ id: vendorShortlistItems.id })
        vendorShortlistItemIds.push(...rows.map(row => row.id))
      }

      const now = new Date()
      await tx
        .update(decisionProposals)
        .set({ status: 'confirmed', confirmedBy: input.userId, confirmedAt: now })
        .where(eq(decisionProposals.id, proposal.id))
      await tx
        .update(planningThreads)
        .set({ status: 'open', currentDecisionId: decision!.id, updatedAt: now })
        .where(eq(planningThreads.id, proposal.threadId))

      const result: Omit<CommitDecisionResult, 'replayed'> = {
        proposalId: proposal.id,
        decisionId: decision!.id,
        taskIds,
        memoryClaimIds,
        externalActionIds,
        momentId,
        vendorShortlistItemIds,
      }
      await tx
        .update(idempotencyRecords)
        .set({ response: result })
        .where(eq(idempotencyRecords.id, reservation.id))

      return { ...result, replayed: false }
    })
    await recomputeWeddingSchedule(input.weddingId)
    return result
  }
}
