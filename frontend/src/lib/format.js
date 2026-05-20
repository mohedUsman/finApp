const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(minorUnits) {
  if (minorUnits == null) return '—'
  return inrFmt.format(Number(minorUnits) / 100)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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
