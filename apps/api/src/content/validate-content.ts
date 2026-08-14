/**
 * Static self-check over the authored content.
 *
 * Every failure here is silent in production: a predicate that references a
 * misspelled answer key never matches, so the task simply disappears from every
 * couple's list and nobody finds out. That makes these checks worth more than
 * their line count. Run from the unit tests and from
 * `scripts/verify-generation.ts`.
 */

import {
  QUEST_TEMPLATES,
  type QuestTemplate,
  type SectionTemplate,
} from './quest-templates'
import { CULTURE_PACKS } from './culture-packs'
import { parsePredicate, referencedAnswerKeys, PredicateError } from './predicates'

export interface ContentProblem {
  where: string
  problem: string
}

function everyTemplate(): QuestTemplate[] {
  return [...QUEST_TEMPLATES, ...CULTURE_PACKS.flatMap(p => p.quests)]
}

function everySection(): { questKey: string; section: SectionTemplate }[] {
  const base = QUEST_TEMPLATES.flatMap(q =>
    q.sections.map(section => ({ questKey: q.key, section })),
  )
  const packQuests = CULTURE_PACKS.flatMap(p =>
    p.quests.flatMap(q => q.sections.map(section => ({ questKey: q.key, section }))),
  )
  const grafts = CULTURE_PACKS.flatMap(p =>
    p.grafts.map(g => ({ questKey: g.questKey, section: g.section })),
  )
  return [...base, ...packQuests, ...grafts]
}

/**
 * Scheduling currently resolves prerequisites in ascending quest order. Make
 * that dependency explicit: a prerequisite must exist and must have a lower
 * order than the quest that reads it. Without this check the generator silently
 * ignores a forward reference and produces the wrong deadline.
 */
export function validateQuestPrerequisites(
  templates: QuestTemplate[],
): ContentProblem[] {
  const problems: ContentProblem[] = []
  const byKey = new Map<string, QuestTemplate>()

  for (const template of templates) {
    if (byKey.has(template.key)) {
      problems.push({
        where: `${template.key}.prerequisites`,
        problem: `duplicate quest key: ${template.key}`,
      })
      continue
    }
    byKey.set(template.key, template)
  }

  for (const template of templates) {
    for (const prerequisiteKey of template.prerequisites) {
      const prerequisite = byKey.get(prerequisiteKey)
      if (!prerequisite) {
        problems.push({
          where: `${template.key}.prerequisites`,
          problem: `unknown prerequisite: ${prerequisiteKey}`,
        })
        continue
      }
      if (prerequisite.order >= template.order) {
        problems.push({
          where: `${template.key}.prerequisites`,
          problem: `prerequisite ${prerequisiteKey} must have a lower order than ${template.key}`,
        })
      }
    }
  }

  return problems
}

/** Answer key → the option values its question declares. */
export function declaredAnswers(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const template of everyTemplate()) {
    const ns = template.answerNamespace ?? template.key
    for (const question of template.scopingQuestions ?? []) {
      out.set(`${ns}.${question.key}`, question.options)
    }
  }
  return out
}

export function validateContent(): ContentProblem[] {
  const templates = everyTemplate()
  const problems: ContentProblem[] = validateQuestPrerequisites(templates)
  const declared = declaredAnswers()

  const checkPredicates = (where: string, sources: string[] | undefined) => {
    for (const src of sources ?? []) {
      try {
        parsePredicate(src)
      } catch (err) {
        problems.push({
          where,
          problem: err instanceof PredicateError ? err.message : String(err),
        })
        continue
      }
      for (const key of referencedAnswerKeys(src)) {
        if (!declared.has(key)) {
          problems.push({ where, problem: `predicate reads undeclared answer: ${key}` })
        }
      }
    }
  }

  for (const { questKey, section } of everySection()) {
    checkPredicates(`${questKey}.section.${section.key}`, section.appliesWhen)
    for (const task of section.tasks) {
      checkPredicates(`${questKey}.task.${task.key}`, task.appliesWhen)
    }
  }

  // A default that is not one of the options would resolve to a value no
  // predicate can ever match.
  for (const template of everyTemplate()) {
    const taskKeys = new Set(template.sections.flatMap(section => section.tasks.map(task => task.key)))
    const taskEdges = new Map<string, string[]>()
    for (const task of template.sections.flatMap(section => section.tasks)) {
      taskEdges.set(task.key, task.dependsOn ?? [])
      for (const dependency of task.dependsOn ?? []) {
        if (!taskKeys.has(dependency)) {
          problems.push({
            where: `${template.key}.task.${task.key}.dependsOn`,
            problem: `unknown task prerequisite: ${dependency}`,
          })
        }
        if (dependency === task.key) {
          problems.push({
            where: `${template.key}.task.${task.key}.dependsOn`,
            problem: 'a task cannot depend on itself',
          })
        }
      }
    }
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (key: string) => {
      if (visiting.has(key)) {
        problems.push({
          where: `${template.key}.task.${key}.dependsOn`,
          problem: 'task dependency cycle detected',
        })
        return
      }
      if (visited.has(key)) return
      visiting.add(key)
      for (const dependency of taskEdges.get(key) ?? []) {
        if (taskKeys.has(dependency)) visit(dependency)
      }
      visiting.delete(key)
      visited.add(key)
    }
    for (const key of taskKeys) visit(key)

    for (const question of template.scopingQuestions ?? []) {
      const at = `${template.key}.question.${question.key}`
      if (!question.options.includes(question.defaultValue)) {
        problems.push({
          where: at,
          problem: `defaultValue "${question.defaultValue}" is not one of its options`,
        })
      }
      if (question.options.length < 2) {
        problems.push({ where: at, problem: 'a question needs at least two options' })
      }
      if (new Set(question.options).size !== question.options.length) {
        problems.push({ where: at, problem: 'duplicate option values' })
      }
    }
  }

  // Every declared question should actually do something. A question that no
  // predicate reads is an interview question, and the budget for those is zero.
  const read = new Set<string>()
  for (const { section } of everySection()) {
    for (const src of [
      ...(section.appliesWhen ?? []),
      ...section.tasks.flatMap(t => t.appliesWhen ?? []),
    ]) {
      try {
        for (const key of referencedAnswerKeys(src)) read.add(key)
      } catch {
        // Already reported above.
      }
    }
  }
  for (const key of declared.keys()) {
    if (!read.has(key)) {
      problems.push({ where: key, problem: 'question is asked but no task depends on it' })
    }
  }

  return problems
}
