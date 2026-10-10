const fmtCache = new Map()

function currencyFormatter(currencyCode) {
  const code = currencyCode || 'INR'
  if (!fmtCache.has(code)) {
    fmtCache.set(code, new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }))
  }
  return fmtCache.get(code)
}

/** currencyCode defaults to INR for backward compatibility with pre-multi-currency call sites. */
export function formatCurrency(minorUnits, currencyCode) {
  if (minorUnits == null) return '—'
  try {
    return currencyFormatter(currencyCode).format(Number(minorUnits) / 100)
  } catch {
    // Unknown/unsupported ISO code — fall back to a plain numeric + code label.
    return `${(Number(minorUnits) / 100).toFixed(2)} ${currencyCode || 'INR'}`
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Tailwind colour class for a variance figure (actual - expected).
 *
 * The sign alone does not say whether the news is good: for an EXPENSE,
 * a positive variance means overspending, while for INCOME it means
 * earning more than planned. Colouring purely by sign paints overspending
 * green, which is the opposite of the truth.
 */
export function varianceColor(varianceMinor, type) {
  const v = Number(varianceMinor ?? 0)
  if (v === 0) return 'text-slate-400'
  const favourable = type === 'EXPENSE' ? v < 0 : v > 0
  return favourable ? 'text-emerald-400' : 'text-red-400'
}

/** Today as `YYYY-MM-DD` in the local timezone, for <input type="date">. */
export function todayISO() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthName(m) {
  return MONTHS[m - 1] ?? ''
}

export function currentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function prevMonth(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}
