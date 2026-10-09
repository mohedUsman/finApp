import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Renders the loading and error phases of a TanStack query.
 *
 * Pages showing money must never fall back to `?? 0` on failure — a
 * confident "₹0.00" is indistinguishable from a real balance, so a failed
 * request reads as "you have nothing". Wrap the content instead and let
 * this surface the actual state.
 *
 * Returns `null` when the query has settled, so the caller renders normally.
 */
export default function QueryState({ isLoading, isError, error, onRetry, label = 'data' }) {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 flex items-center justify-center gap-3">
        <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
        <span className="text-sm text-slate-500">Loading {label}…</span>
      </div>
    )
  }

  if (isError) {
    const status = error?.response?.status
    const detail = status === 401
      ? 'Your session expired. Please sign in again.'
      : error?.response?.data?.message ?? error?.message ?? 'Something went wrong.'
    return (
      <div
        role="alert"
        className="bg-red-950/40 border border-red-900/60 rounded-lg p-4 flex items-start gap-3"
      >
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-red-300">Couldn&apos;t load {label}</div>
          <div className="text-xs text-red-400/80 mt-0.5 break-words">{detail}</div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-red-900/60 hover:bg-red-900 text-red-100 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return null
}
