import api from './apiClient'
import { formatCurrency } from './format'

/**
 * Fired after an EXPENSE transaction save succeeds. The monthly report is the
 * source of truth for spend-vs-budget, so re-fetch it rather than compute
 * client-side from a stale transaction list.
 */
export async function checkBudgetAlert(categoryId, toast) {
  if (!categoryId) return
  try {
    const today = new Date()
    const { data: report } = await api.get(
      `/reports/monthly?year=${today.getFullYear()}&month=${today.getMonth() + 1}`
    )
    const cat = report.byCategory?.find(c => c.categoryId === categoryId)
    if (!cat || cat.monthlyBudgetMinor == null) return
    if (cat.actualAmountMinor > cat.monthlyBudgetMinor) {
      const over = cat.actualAmountMinor - cat.monthlyBudgetMinor
      toast.warning(`${cat.categoryName} is ${formatCurrency(over)} over its monthly budget`)
    }
  } catch {
    // Non-critical UX nicety — never block the save flow on this check.
  }
}
