import { describe, expect, it } from 'bun:test'
import { traceSafeSpan } from './trace-sanitize'

const now = new Date('2026-08-13T12:00:00Z')

describe('trace privacy boundary', () => {
  it('records model shape without copying assistant text or tool arguments', () => {
    const safe = traceSafeSpan({
      kind: 'model_call',
      name: 'model-v1',
      input: { messageCount: 4, toolNames: ['propose_decision'] },
      output: {
        text: 'Private relationship context belongs only in the conversation.',
        toolCalls: [{
          name: 'propose_decision',
          input: { reason: 'A private family reason', externalActions: [{ body: 'secret' }] },
          providerContext: { geminiThoughtSignature: 'opaque-provider-secret' },
        }],
      },
      startedAt: now,
      endedAt: now,
    })
    expect(JSON.stringify(safe)).not.toContain('Private relationship')
    expect(JSON.stringify(safe)).not.toContain('private family')
    expect(JSON.stringify(safe)).not.toContain('opaque-provider-secret')
    expect(safe.output).toEqual({
      hasText: true,
      textLength: 62,
      toolCalls: [{ name: 'propose_decision', inputKeys: ['externalActions', 'reason'] }],
    })
  })

  it('stores proposal counts but no reasons, narratives, or email payloads', () => {
    const safe = traceSafeSpan({
      kind: 'tool_call',
      name: 'propose_decision',
      input: {
        schemaVersion: 1,
        questKey: 'vendor_team',
        questionKey: 'photo.coverage',
        state: 'ready',
        proposedChoice: 'photo_video',
        reason: 'Private reason',
        memberInputs: [{ reason: 'Private member reason' }, { reason: 'Another reason' }],
        taskEffects: [{ taskKey: 'book_videographer' }],
        memoryEffects: [{ value: 'Private preference' }],
        externalActions: [{ payload: { body: 'hello@example.com' } }],
        vendorEffects: [{ candidateId: 'one' }, { candidateId: 'two' }, { candidateId: 'three' }],
        momentCandidate: { narrative: 'Private moment' },
      },
      output: { proposalId: 'proposal-1', version: 1, status: 'pending' },
      startedAt: now,
      endedAt: now,
    })
    const serialized = JSON.stringify(safe)
    expect(serialized).not.toContain('Private')
    expect(serialized).not.toContain('hello@example.com')
    expect(safe.input).toMatchObject({
      representedMembers: 2,
      taskEffectCount: 1,
      memoryEffectCount: 1,
      externalActionCount: 1,
      vendorEffectCount: 3,
      hasMomentCandidate: true,
    })
  })

  it('redacts contact details and secrets from recorded errors', () => {
    const safe = traceSafeSpan({
      kind: 'policy_check',
      name: 'provider',
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Failed for hello@example.com at +1 (212) 555-1212 with Bearer secret-token',
        retryable: false,
      },
      startedAt: now,
      endedAt: now,
    })
    expect(safe.error?.message).toContain('[redacted-email]')
    expect(safe.error?.message).toContain('[redacted-phone]')
    expect(safe.error?.message).toContain('[redacted-secret]')
  })
})
