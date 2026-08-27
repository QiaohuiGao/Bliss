import { z } from 'zod'
import { QUEST_TEMPLATES } from '../../content/quest-templates'
import { tasksForQuest, resolveTree, type ResolverInput } from '../../services/quest-resolver'
import { AgentGuardrailError } from '../errors'
import { decisionPacketJsonSchema, decisionPacketSchema, type AgentTool } from '../types'
import type { DecisionProposalStore } from '../proposals/store'
import { parseExternalActionPayload } from '../actions/contracts'
import { referencedAnswerKeys } from '../../content/predicates'
import { VOICE_CONTRACT_V1 } from './voice'

export const ATTIRE_QUEST_KEY = 'attire_beauty'
export const ATTIRE_QUESTION_KEY = 'attire.dress_acquisition'

const attireTemplate = QUEST_TEMPLATES.find(template => template.key === ATTIRE_QUEST_KEY)
if (!attireTemplate) throw new Error('Attire quest template is missing')

const acquisitionQuestion = attireTemplate.scopingQuestions?.find(
  question => `${attireTemplate.answerNamespace ?? attireTemplate.key}.${question.key}` === ATTIRE_QUESTION_KEY,
)
if (!acquisitionQuestion) throw new Error('Attire acquisition question is missing')
const acquisitionOptions = acquisitionQuestion.options as [string, ...string[]]
const acquisitionControlledTaskKeys = new Set(attireTemplate.sections.flatMap(section => {
  const sectionControlled = section.appliesWhen?.some(predicate =>
    referencedAnswerKeys(predicate).includes(ATTIRE_QUESTION_KEY),
  ) ?? false
  return section.tasks
    .filter(task => sectionControlled || task.appliesWhen?.some(predicate =>
      referencedAnswerKeys(predicate).includes(ATTIRE_QUESTION_KEY),
    ))
    .map(task => task.key)
}))

const choiceSchema = z.object({
  choice: z.enum(acquisitionOptions),
})

export interface AttireToolOptions {
  resolverInput: Omit<ResolverInput, 'answers'>
  proposalStore: DecisionProposalStore
}

export function createAttireTools(options: AttireToolOptions): AgentTool[] {
  const candidateTaskKeysByChoice = new Map<string, Set<string>>()

  const candidateTool: AgentTool = {
    definition: {
      name: 'get_candidate_tasks',
      description: 'Get the authored Attire & Beauty task candidates for one valid gown acquisition choice. Call this before proposing a decision.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['choice'],
        properties: {
          choice: { type: 'string', enum: acquisitionOptions },
        },
      },
    },
    parallelSafe: true,
    async execute(input) {
      const { choice } = choiceSchema.parse(input)
      const candidates = tasksForQuest(resolveTree({
        ...options.resolverInput,
        answers: { [ATTIRE_QUESTION_KEY]: choice },
      }), ATTIRE_QUEST_KEY).filter(candidate => acquisitionControlledTaskKeys.has(candidate.taskKey))
      candidateTaskKeysByChoice.set(choice, new Set(candidates.map(candidate => candidate.taskKey)))
      return {
        questKey: ATTIRE_QUEST_KEY,
        questionKey: ATTIRE_QUESTION_KEY,
        choice,
        candidates,
        instruction: 'Select at most 8 fitting tasks. Do not invent task keys.',
      }
    },
  }

  const proposalTool: AgentTool = {
    definition: {
      name: 'propose_decision',
      description: 'Create the single user-visible Decision Packet. This is a proposal only; it cannot commit tasks, memory, or external actions.',
      inputSchema: decisionPacketJsonSchema,
    },
    terminal: true,
    async execute(input, context) {
      const packet = decisionPacketSchema.parse(input)
      if (packet.threadId !== context.threadId) {
        throw new AgentGuardrailError('THREAD_SCOPE_MISMATCH', 'Proposal thread does not match the active run')
      }
      if (packet.questKey !== ATTIRE_QUEST_KEY || packet.questionKey !== ATTIRE_QUESTION_KEY) {
        throw new AgentGuardrailError('QUEST_SCOPE_MISMATCH', 'This run may only propose the attire acquisition decision')
      }
      if (packet.state === 'ready' && (!packet.proposedChoice || !packet.reason)) {
        throw new AgentGuardrailError('INCOMPLETE_DECISION', 'A ready proposal needs a choice and the couple-specific reason')
      }
      if (packet.state === 'contested') {
        if (packet.taskEffects.length || packet.externalActions.length || packet.vendorEffects.length) {
          throw new AgentGuardrailError(
            'CONTESTED_SIDE_EFFECT',
            'Do not propose tasks, vendors, or external actions until the couple reaches a shared choice',
          )
        }
        return options.proposalStore.create(context, packet)
      }
      const offeredTaskKeys = packet.proposedChoice
        ? candidateTaskKeysByChoice.get(packet.proposedChoice)
        : undefined
      if (!offeredTaskKeys) {
        throw new AgentGuardrailError('CANDIDATES_NOT_READ', 'Call get_candidate_tasks before proposing tasks')
      }
      const taskKeys = packet.taskEffects.map(task => task.taskKey)
      if (new Set(taskKeys).size !== taskKeys.length) {
        throw new AgentGuardrailError('DUPLICATE_TASK_EFFECT', 'A task may only appear once in a proposal')
      }
      const invented = packet.taskEffects
        .map(task => task.taskKey)
        .filter(taskKey => !offeredTaskKeys?.has(taskKey))
      if (invented.length > 0) {
        throw new AgentGuardrailError(
          'INVENTED_TASK',
          `These task keys were not in the candidate pool: ${invented.join(', ')}`,
        )
      }
      if (packet.proposedChoice && !acquisitionOptions.includes(packet.proposedChoice)) {
        throw new AgentGuardrailError('INVALID_CHOICE', 'Proposed choice is not an authored option')
      }
      for (const action of packet.externalActions) {
        parseExternalActionPayload(action.kind, action.payload)
      }

      const proposedByKey = new Map(packet.taskEffects.map(effect => [effect.taskKey, effect]))
      return options.proposalStore.create(context, {
        ...packet,
        taskEffects: [...offeredTaskKeys!].map(taskKey => proposedByKey.get(taskKey) ?? ({
          taskKey,
          rationale: packet.reason ?? packet.summary,
        })),
      })
    },
  }

  return [candidateTool, proposalTool]
}

export const ATTIRE_AGENT_PROMPT_V1 = `You are Bliss, a thoughtful and capable wedding planning companion.

Your goal in this run is to help the couple decide whether the gown will be rented, bought off the rack, or custom ordered. Reflect what they said, do not manufacture preferences, and keep the work small.

Rules:
- Read candidate tasks before proposing tasks.
- Propose at most 8 tasks as highlights and use only returned task keys. Deterministic code completes the valid branch.
- Every recommendation must cite the couple's stated reason.
- Every memory claim must cite message IDs from this thread.
- If the two members disagree, propose state=contested with no tasks. Represent both sides neutrally.
- External actions are drafts and must require approval.
- Reminder payload: { title, triggerAt } with an ISO timestamp and timezone offset.
- Calendar payload: { title, startsAt, optional endsAt, location, description } with timezone offsets.
- Email draft payload: { subject, body, recipients }.
- Vendor shortlist payload: { criteria, optional location, maxResults }.
- Finish by calling propose_decision exactly once.`

export const ATTIRE_AGENT_PROMPT_V3 = `You are Bliss, a thoughtful and capable wedding planning companion.

Your goal in this run is to help the couple decide whether the gown will be rented, bought off the rack, or custom ordered. Reflect what they said, do not manufacture preferences, and keep the work small.

Rules:
- Read candidate tasks before proposing tasks.
- Propose at most 8 tasks as highlights and use only returned task keys. Deterministic code completes the valid branch.
- Every recommendation must cite the couple's stated reason.
- Every memory claim must cite message IDs from this thread.
- If decision-changing information is missing, ask one concise follow-up question and do not call propose_decision yet.
- Keep an unheard member's view unknown. Never invent agreement or treat silence as a shared preference.
- If the two members disagree, propose state=contested with no tasks. Represent both sides neutrally.
- External actions are drafts until approval. Use send_email only when the couple explicitly asks Bliss to send and the exact recipients, subject, and body are known; otherwise use draft_email.
- Reminder payload: { title, triggerAt } with an ISO timestamp and timezone offset.
- Calendar payload: { title, startsAt, optional endsAt, location, description } with timezone offsets.
- Email draft payload: { subject, body, recipients }.
- Email send payload: { subject, body, recipients, optional replyTo } with at least one recipient.
- Vendor shortlist payload: { criteria, optional location, maxResults }.
- When enough information exists for a grounded ready or contested packet, finish by calling propose_decision exactly once.`

// Written out in full rather than derived from V3 by string surgery. A released prompt is
// an immutable artifact: if it is computed from a newer sibling, editing that sibling
// silently rewrites the baseline the release gate compares candidates against.
export const ATTIRE_AGENT_PROMPT_V2 = `You are Bliss, a thoughtful and capable wedding planning companion.

Your goal in this run is to help the couple decide whether the gown will be rented, bought off the rack, or custom ordered. Reflect what they said, do not manufacture preferences, and keep the work small.

Rules:
- Read candidate tasks before proposing tasks.
- Propose at most 8 tasks as highlights and use only returned task keys. Deterministic code completes the valid branch.
- Every recommendation must cite the couple's stated reason.
- Every memory claim must cite message IDs from this thread.
- If decision-changing information is missing, ask one concise follow-up question and do not call propose_decision yet.
- Keep an unheard member's view unknown. Never invent agreement or treat silence as a shared preference.
- If the two members disagree, propose state=contested with no tasks. Represent both sides neutrally.
- External actions are drafts and must require approval.
- Reminder payload: { title, triggerAt } with an ISO timestamp and timezone offset.
- Calendar payload: { title, startsAt, optional endsAt, location, description } with timezone offsets.
- Email draft payload: { subject, body, recipients }.
- Vendor shortlist payload: { criteria, optional location, maxResults }.
- When enough information exists for a grounded ready or contested packet, finish by calling propose_decision exactly once.`

/**
 * V4 adds the voice contract. Composition from two named, versioned artifacts is not the
 * same thing as the string surgery removed above: both parts are immutable and the bundle
 * records which version of each it used.
 */
export const ATTIRE_AGENT_PROMPT_V4 = `${VOICE_CONTRACT_V1}

${ATTIRE_AGENT_PROMPT_V3}`

export const ATTIRE_AGENT_PROMPT = ATTIRE_AGENT_PROMPT_V4
