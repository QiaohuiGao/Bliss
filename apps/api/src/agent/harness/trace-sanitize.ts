import type { AgentSpanRecord } from '../types'

const redactText = (value: string) => value
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
  .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[redacted-phone]')
  .replace(/(?:\bbearer\s+|\bsk_|\bSG\.)[^\s,;]+/gi, '[redacted-secret]')
  .slice(0, 500)

const objectValue = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
)

const countArray = (value: unknown) => Array.isArray(value) ? value.length : 0

function safeToolInput(name: string, value: unknown): unknown {
  const input = objectValue(value)
  if (!input) return { valueType: typeof value }
  if (name === 'get_candidate_tasks') return { choice: input['choice'] ?? null }
  if (name === 'search_photographers') {
    return {
      style: input['style'] ?? null,
      limit: input['limit'] ?? null,
      hasBudgetLimit: typeof input['budgetMaxCents'] === 'number',
      locationProvided: Boolean(input['city'] && input['state']),
    }
  }
  if (name === 'propose_decision') {
    return {
      schemaVersion: input['schemaVersion'] ?? null,
      questKey: input['questKey'] ?? null,
      questionKey: input['questionKey'] ?? null,
      state: input['state'] ?? null,
      proposedChoice: input['proposedChoice'] ?? null,
      representedMembers: countArray(input['memberInputs']),
      taskEffectCount: countArray(input['taskEffects']),
      memoryEffectCount: countArray(input['memoryEffects']),
      externalActionCount: countArray(input['externalActions']),
      vendorEffectCount: countArray(input['vendorEffects']),
      hasMomentCandidate: Boolean(input['momentCandidate']),
    }
  }
  return { keys: Object.keys(input).sort() }
}

function safeToolOutput(name: string, value: unknown): unknown {
  const output = objectValue(value)
  if (!output) return { valueType: typeof value }
  if (name === 'get_candidate_tasks') {
    return {
      choice: output['choice'] ?? null,
      candidateCount: countArray(output['candidates']),
    }
  }
  if (name === 'search_photographers') {
    return {
      searchId: output['searchId'] ?? null,
      candidateCount: countArray(output['candidates']),
      untrustedExternalContent: output['untrustedExternalContent'] === true,
    }
  }
  if (name === 'propose_decision') {
    return {
      proposalId: output['proposalId'] ?? null,
      version: output['version'] ?? null,
      status: output['status'] ?? null,
    }
  }
  return { keys: Object.keys(output).sort() }
}

/** Persist operational shape and lineage, never a second copy of couple content. */
export function traceSafeSpan(span: AgentSpanRecord): AgentSpanRecord {
  if (span.kind === 'model_call') {
    const output = objectValue(span.output)
    const calls = Array.isArray(output?.['toolCalls']) ? output['toolCalls'] : []
    return {
      ...span,
      input: objectValue(span.input) ?? { present: span.input !== undefined },
      output: {
        hasText: typeof output?.['text'] === 'string' && output['text'].length > 0,
        textLength: typeof output?.['text'] === 'string' ? output['text'].length : 0,
        toolCalls: calls.map(call => {
          const item = objectValue(call)
          return {
            name: typeof item?.['name'] === 'string' ? item['name'] : 'unknown',
            inputKeys: Object.keys(objectValue(item?.['input']) ?? {}).sort(),
          }
        }),
      },
      error: span.error ? { ...span.error, message: redactText(span.error.message) } : undefined,
    }
  }
  return {
    ...span,
    input: safeToolInput(span.name, span.input),
    output: span.output === undefined ? undefined : safeToolOutput(span.name, span.output),
    error: span.error ? { ...span.error, message: redactText(span.error.message) } : undefined,
  }
}
