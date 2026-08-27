export interface FindOrCreateQuestionThreadOptions<T> {
  find: () => Promise<T | undefined>
  tryCreate: () => Promise<T | undefined>
}

/**
 * Resolves the permanent thread for a question without relying on a read-before-
 * write race. `tryCreate` must use the database unique constraint and return
 * undefined when another request wins the insert.
 */
export async function findOrCreateQuestionThread<T>(
  options: FindOrCreateQuestionThreadOptions<T>,
): Promise<T | undefined> {
  const existing = await options.find()
  if (existing) return existing

  const created = await options.tryCreate()
  if (created) return created

  return options.find()
}
