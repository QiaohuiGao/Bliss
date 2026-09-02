import { z } from 'zod'
import { QUEST_TEMPLATES, type QuestTemplate } from '../../content/quest-templates'
import { referencedAnswerKeys } from '../../content/predicates'
import { resolveTree, tasksForQuest, type ResolverInput } from '../../services/quest-resolver'
import { parseExternalActionPayload } from '../actions/contracts'
import { AgentGuardrailError } from '../errors'
import type { DecisionProposalStore } from '../proposals/store'
import { decisionPacketJsonSchema, decisionPacketSchema, type AgentTool } from '../types'

export interface QuestScopingToolOptions {
  questKey: string
  questionKey: string
  resolverInput: Omit<ResolverInput, 'answers'>
  activeAnswers: Record<string, string>
  proposalStore: DecisionProposalStore
}

const candidateInputSchema = z.object({
  questionKey: z.string().min(1),
  choice: z.string().min(1),
  customChoice: z.string().trim().min(1).max(2_000).optional(),
})

const qualifies = (template: QuestTemplate, questionKey: string) =>
  `${template.answerNamespace ?? template.key}.${questionKey}`

export function getQuestScopingOverview(
  questKey: string,
  activeAnswers: Record<string, string>,
  activeQuestionKey?: string,
  activeCustomChoices: Record<string, string | null> = {},
) {
  const template = QUEST_TEMPLATES.find(item => item.key === questKey)
  if (!template?.scopingQuestions?.length) {
    throw new AgentGuardrailError('QUEST_NOT_SCOPABLE', 'This quest has no authored scoping questions')
  }
  const questions = template.scopingQuestions.map(question => {
    const questionKey = qualifies(template, question.key)
    const confirmed = activeAnswers[questionKey]
    return {
      questionKey,
      promptI18nKey: `quest.${template.key}.question.${question.key}.prompt`,
      helpI18nKey: `quest.${template.key}.question.${question.key}.help`,
      options: question.options.map(value => ({
        value,
        labelI18nKey: `quest.${template.key}.question.${question.key}.option.${value}`,
      })),
      currentChoice: confirmed ?? question.defaultValue,
      currentCustomChoice: confirmed === 'other' ? activeCustomChoices[questionKey] ?? null : null,
      source: confirmed ? 'confirmed' as const : 'assumed' as const,
      allowsDefer: question.allowsDefer,
      allowsCustom: true,
    }
  })
  if (template.key === 'vendor_team') {
    const questionKey = 'photo.photographer_choice'
    const confirmed = activeAnswers[questionKey]
    questions.push({
      questionKey,
      promptI18nKey: 'quest.vendor_team.question.photographer_choice.prompt',
      helpI18nKey: 'quest.vendor_team.question.photographer_choice.help',
      options: [],
      currentChoice: confirmed ?? '',
      currentCustomChoice: null,
      source: confirmed ? 'confirmed' as const : 'assumed' as const,
      allowsDefer: true,
      allowsCustom: false,
    })
  }
  return {
    questKey: template.key,
    titleI18nKey: `quest.${template.key}.title`,
    subtitleI18nKey: `quest.${template.key}.subtitle`,
    questions: questions.filter(question => !activeQuestionKey || question.questionKey === activeQuestionKey),
  }
}

function controlledTaskKeys(template: QuestTemplate, questionKey: string): Set<string> {
  const keys = new Set<string>()
  for (const section of template.sections) {
    const sectionIsControlled = section.appliesWhen?.some(predicate =>
      referencedAnswerKeys(predicate).includes(questionKey),
    ) ?? false
    for (const task of section.tasks) {
      const taskIsControlled = task.appliesWhen?.some(predicate =>
        referencedAnswerKeys(predicate).includes(questionKey),
      ) ?? false
      if (sectionIsControlled || taskIsControlled) keys.add(task.key)
    }
  }
  return keys
}

export function createQuestScopingTools(options: QuestScopingToolOptions): AgentTool[] {
  const template = QUEST_TEMPLATES.find(item => item.key === options.questKey)
  if (!template?.scopingQuestions?.length) {
    throw new AgentGuardrailError('QUEST_NOT_SCOPABLE', 'This quest has no authored scoping questions')
  }
  const questions = new Map(template.scopingQuestions.map(question => {
    const questionKey = qualifies(template, question.key)
    return [questionKey, question] as const
  }).filter(([questionKey]) => questionKey === options.questionKey))
  if (questions.size !== 1) {
    throw new AgentGuardrailError(
      'INVALID_QUESTION',
      'The active question is not authored for this quest',
    )
  }
  const activeQuestion = [...questions.values()][0]!
  const offeredTasks = new Map<string, Set<string>>()

  const questionTool: AgentTool = {
    definition: {
      name: 'get_scoping_questions',
      description: 'Read the authored choices and current answer state for this quest before discussing a decision.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    },
    parallelSafe: true,
    async execute() {
      return getQuestScopingOverview(template.key, options.activeAnswers, options.questionKey)
    },
  }

  const candidateTool: AgentTool = {
    definition: {
      name: 'get_candidate_tasks',
      description: 'Get only the authored tasks changed by one exact quest question and choice.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['questionKey', 'choice'],
        properties: {
          questionKey: { type: 'string', enum: [...questions.keys()] },
          choice: { type: 'string', enum: [...activeQuestion.options, 'other'] },
          customChoice: { type: 'string', minLength: 1, maxLength: 2_000 },
        },
      },
    },
    parallelSafe: true,
    async execute(input) {
      const parsed = candidateInputSchema.parse(input)
      const question = questions.get(parsed.questionKey)
      if (!question) {
        throw new AgentGuardrailError('INVALID_QUESTION', 'Question is not authored for this quest')
      }
      const isCustomChoice = parsed.choice === 'other'
      if (!isCustomChoice && !question.options.includes(parsed.choice)) {
        throw new AgentGuardrailError('INVALID_CHOICE', 'Choice is not authored for this question')
      }
      if (isCustomChoice && !parsed.customChoice) {
        throw new AgentGuardrailError('CUSTOM_CHOICE_REQUIRED', 'Other requires the couple\'s own choice')
      }
      const resolverChoice = isCustomChoice ? question.defaultValue : parsed.choice
      const controlled = controlledTaskKeys(template, parsed.questionKey)
      const candidates = tasksForQuest(resolveTree({
        ...options.resolverInput,
        answers: { ...options.activeAnswers, [parsed.questionKey]: resolverChoice },
      }), template.key).filter(task => controlled.has(task.taskKey))
      offeredTasks.set(`${parsed.questionKey}:${parsed.choice}`, new Set(
        candidates.map(candidate => candidate.taskKey),
      ))
      return {
        questKey: template.key,
        questionKey: parsed.questionKey,
        choice: parsed.choice,
        candidates,
        instruction: 'Use only these branch-changing task keys. An empty list is a valid result.',
      }
    },
  }

  const proposalTool: AgentTool = {
    definition: {
      name: 'propose_decision',
      description: 'Create one user-visible Decision Packet for one authored question. This does not commit changes.',
      inputSchema: decisionPacketJsonSchema,
    },
    terminal: true,
    async execute(input, context) {
      const packet = decisionPacketSchema.parse(input)
      if (packet.threadId !== context.threadId) {
        throw new AgentGuardrailError('THREAD_SCOPE_MISMATCH', 'Proposal thread does not match this run')
      }
      if (packet.questKey !== template.key) {
        throw new AgentGuardrailError('QUEST_SCOPE_MISMATCH', 'Proposal does not match this quest')
      }
      const question = questions.get(packet.questionKey)
      if (!question) {
        throw new AgentGuardrailError('INVALID_QUESTION', 'Proposal question is not authored for this quest')
      }
      if (packet.state === 'contested') {
        if (packet.taskEffects.length || packet.externalActions.length || packet.vendorEffects.length) {
          throw new AgentGuardrailError(
            'CONTESTED_SIDE_EFFECT',
            'A contested proposal cannot create tasks, vendor choices, or external actions',
          )
        }
        return options.proposalStore.create(context, packet)
      }
      if (!packet.proposedChoice || !packet.reason) {
        throw new AgentGuardrailError('INCOMPLETE_DECISION', 'A ready proposal needs a choice and reason')
      }
      const isCustomChoice = packet.proposedChoice === 'other'
      if (!isCustomChoice && packet.customChoice) {
        throw new AgentGuardrailError('UNEXPECTED_CUSTOM_CHOICE', 'Authored choices must not include custom choice text')
      }
      if (isCustomChoice && !packet.customChoice) {
        throw new AgentGuardrailError('CUSTOM_CHOICE_REQUIRED', 'Other requires the couple\'s own choice')
      }
      if (!isCustomChoice && !question.options.includes(packet.proposedChoice)) {
        throw new AgentGuardrailError('INVALID_CHOICE', 'Proposal choice is not authored for this question')
      }
      const taskPool = offeredTasks.get(`${packet.questionKey}:${packet.proposedChoice}`)
      if (!taskPool) {
        throw new AgentGuardrailError('CANDIDATES_NOT_READ', 'Read candidates for this exact question and choice first')
      }
      const taskKeys = packet.taskEffects.map(effect => effect.taskKey)
      if (new Set(taskKeys).size !== taskKeys.length) {
        throw new AgentGuardrailError('DUPLICATE_TASK_EFFECT', 'A task may only appear once in a proposal')
      }
      if (taskKeys.some(taskKey => !taskPool.has(taskKey))) {
        throw new AgentGuardrailError('INVENTED_TASK', 'Proposal contains a task outside the authored branch')
      }
      if (packet.vendorEffects.length) {
        throw new AgentGuardrailError('VENDOR_TOOL_REQUIRED', 'Use a provider-backed pack for vendor recommendations')
      }
      for (const action of packet.externalActions) {
        parseExternalActionPayload(action.kind, action.payload)
      }
      const proposedByKey = new Map(packet.taskEffects.map(effect => [effect.taskKey, effect]))
      const completeTaskEffects = [...taskPool].map(taskKey => proposedByKey.get(taskKey) ?? ({
        taskKey,
        rationale: packet.reason ?? packet.summary,
      }))
      return options.proposalStore.create(context, {
        ...packet,
        taskEffects: completeTaskEffects,
      })
    },
  }

  return [questionTool, candidateTool, proposalTool]
}

export const QUEST_SCOPING_AGENT_PROMPT_V2 = `You are Bliss, a warm, precise wedding planning companion.

Help the couple make one fitting decision inside the active quest. The task list is an output of that decision, not the interview itself.

Rules:
- Start by reading get_scoping_questions. Work on exactly one authored question per run.
- Use only authored question keys and option values.
- The couple may choose other only when customChoice preserves their exact answer. Read candidate tasks with choice=other and the same customChoice; the resolver will use the authored base branch.
- If decision-changing information is missing, ask one concise follow-up question and stop without proposing.
- Keep each member's view attributed. An unheard member stays unknown; silence is never agreement.
- If the members disagree, create state=contested with no tasks, vendors, or external actions and represent both reasons neutrally.
- Before a ready proposal, read candidate tasks for the exact question and choice.
- Propose only returned branch-changing task keys. An empty candidate list is valid.
- Explain the choice in the couple's own decision criteria, not generic wedding advice.
- Every memory claim and Moment must cite message IDs from this thread.
- External actions are drafts and always require approval. Use send_email only when the couple explicitly asks Bliss to send and the exact recipients, subject, and body are known; otherwise use draft_email.
- This general pack cannot recommend vendors; use a provider-backed pack for that.
- In Legal, never state requirements from model knowledge. Use only verified lookup data; when none is available, direct the couple to the issuing clerk or qualified counsel and keep the rule unknown.
- When enough evidence exists, call propose_decision exactly once.`

export const QUEST_SCOPING_AGENT_PROMPT_V1 = QUEST_SCOPING_AGENT_PROMPT_V2.replace(
  'External actions are drafts and always require approval. Use send_email only when the couple explicitly asks Bliss to send and the exact recipients, subject, and body are known; otherwise use draft_email.',
  'External actions are drafts with exact payloads and always require approval.',
)

export const QUEST_SCOPING_AGENT_PROMPT = QUEST_SCOPING_AGENT_PROMPT_V2
