import { describe, expect, it } from 'bun:test'
import { findOrCreateQuestionThread } from './find-or-create'

describe('question thread creation', () => {
  it('returns one canonical thread when two creates race', async () => {
    type Thread = { id: string }
    let canonical: Thread | undefined
    let insertAttempts = 0
    const find = async () => canonical
    const tryCreate = async () => {
      insertAttempts += 1
      await Promise.resolve()
      if (canonical) return undefined
      canonical = { id: 'thread-1' }
      return canonical
    }

    const [first, second] = await Promise.all([
      findOrCreateQuestionThread({ find, tryCreate }),
      findOrCreateQuestionThread({ find, tryCreate }),
    ])

    expect(insertAttempts).toBe(2)
    expect(first).toBe(canonical)
    expect(second).toBe(canonical)
  })

  it('permanently restores an existing thread without inserting', async () => {
    const canonical = { id: 'thread-1' }
    let insertAttempts = 0
    const result = await findOrCreateQuestionThread({
      find: async () => canonical,
      tryCreate: async () => {
        insertAttempts += 1
        return { id: 'thread-2' }
      },
    })

    expect(result).toBe(canonical)
    expect(insertAttempts).toBe(0)
  })
})
