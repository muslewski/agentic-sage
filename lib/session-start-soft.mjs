// SessionStart stdout soft lines for OSS: cap + priority.
// Never throw. Callers write selected lines with trailing newline via writeSync.
// Priority: preferred offline > fleet peers > wired freshness (max 2).

export const SESSION_START_SOFT_MAX = 2

/**
 * @param {string | null | undefined} line
 * @returns {string} sage:-prefixed body, or '' if empty
 */
export function formatSageSoftLine(line) {
  if (line == null) return ''
  const s = String(line).trim()
  if (!s) return ''
  return s.startsWith('sage:') ? s : `sage: ${s}`
}

/**
 * Pick up to `max` non-empty soft lines in priority order.
 * Pass candidates as preferred, fleet, freshness (left → right = high → low).
 *
 * @param {Array<string | null | undefined>} candidates
 * @param {number} [max=SESSION_START_SOFT_MAX]
 * @returns {string[]}
 */
export function selectSessionStartSoftLines(candidates, max = SESSION_START_SOFT_MAX) {
  const limit = Number.isFinite(max) && max >= 0 ? Math.floor(max) : SESSION_START_SOFT_MAX
  const out = []
  if (!Array.isArray(candidates) || limit === 0) return out
  for (const raw of candidates) {
    if (out.length >= limit) break
    const line = formatSageSoftLine(raw)
    if (line) out.push(line)
  }
  return out
}
