/**
 * How a proposed memory claim enters storage.
 *
 * Two decisions, kept together because they are the same policy seen from two sides:
 * whether the new claim becomes active, and whether it may retire the claim it
 * replaces. Getting the second one wrong is the dangerous half — retiring confirmed
 * memory in favour of an inference the couple has not seen would lose something they
 * actually said and replace it with a guess.
 *
 * Extracted from the commit transaction so the rule is testable without a database.
 */

export type ClaimSource = 'explicit' | 'inferred' | 'decision'
export type ClaimWriteStatus = 'proposed' | 'confirmed'

export interface ClaimWritePlan {
  /** Status for the incoming claim. */
  status: ClaimWriteStatus
  /** Whether the currently confirmed claim for this `(subject, key)` should retire. */
  supersedesCurrent: boolean
}

/**
 * An explicit statement and a confirmed decision are things the couple said or chose,
 * so they become active immediately. An inference is the assistant's guess: it waits
 * for acceptance and is withheld from retrieval until then, which is what keeps the
 * assistant from quoting its own guess back as something it was told.
 */
export function planClaimWrite(source: ClaimSource): ClaimWritePlan {
  const status: ClaimWriteStatus = source === 'inferred' ? 'proposed' : 'confirmed'
  return { status, supersedesCurrent: status === 'confirmed' }
}
