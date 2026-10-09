import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useQuery } from '@tanstack/react-query'
import { UploadCloud, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

function toIsoDate(raw) {
  if (raw == null || raw === '') return null
  // xlsx hands back real Date objects for Excel-style date cells; CSV cells
  // are plain strings, so both shapes need to be normalised to YYYY-MM-DD.
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  const s = String(raw).trim()
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : d.toISOString().slice(0, 10)
}

function parseAmount(raw) {
  if (raw == null || raw === '') return null
  const n = Number(String(raw).replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** Maps a raw CSV row into a validated transaction payload, or a row with `.error` set. */
function validateRow(row, categories) {
  const get = key => {
    const found = Object.keys(row).find(k => k.trim().toLowerCase() === key)
    return found ? row[found] : undefined
  }

  const typeRaw = String(get('type') ?? '').trim().toUpperCase()
  const statusRaw = String(get('status') ?? 'ACTUAL').trim().toUpperCase()
  const categoryName = String(get('category') ?? '').trim()
  const dateRaw = get('date')
  const plannedRaw = get('planned (rs.)') ?? get('planned')
  const actualRaw = get('actual (rs.)') ?? get('actual')
  const note = get('note') ? String(get('note')).trim() : null

  if (!['INCOME', 'EXPENSE'].includes(typeRaw)) {
    return { error: `Invalid type "${typeRaw || '(blank)'}" — must be INCOME or EXPENSE` }
  }
  if (!['EXPECTED', 'ACTUAL'].includes(statusRaw)) {
    return { error: `Invalid status "${statusRaw}" — must be EXPECTED or ACTUAL` }
  }
  const cat = categories.find(c => c.type === typeRaw && c.name.toLowerCase() === categoryName.toLowerCase())
  if (!cat) {
    return { error: `Unknown ${typeRaw.toLowerCase()} category "${categoryName || '(blank)'}"` }
  }

  const date = toIsoDate(dateRaw)
  if (!date) {
    return { error: `Invalid or missing date "${dateRaw ?? ''}"` }
  }

  const amountRaw = statusRaw === 'EXPECTED' ? plannedRaw : actualRaw
  const amount = parseAmount(amountRaw)
  if (amount == null || Number.isNaN(amount) || amount < 0) {
    return { error: `Invalid ${statusRaw === 'EXPECTED' ? 'planned' : 'actual'} amount "${amountRaw ?? ''}"` }
  }

  const payload = {
    type: typeRaw,
    categoryId: cat.id,
    status: statusRaw,
    note,
    expectedAmountMinor: null,
    expectedDate: null,
    actualAmountMinor: null,
    actualDate: null,
  }
  if (statusRaw === 'EXPECTED') {
    payload.expectedAmountMinor = Math.round(amount * 100)
    payload.expectedDate = date
  } else {
    payload.actualAmountMinor = Math.round(amount * 100)
    payload.actualDate = date
    // The server derives variance from the expected side too, so mirror the
    // actual onto expected — matching how the manual entry form behaves.
    payload.expectedAmountMinor = Math.round(amount * 100)
    payload.expectedDate = date
  }
  return { payload, preview: { categoryName: cat.name, type: typeRaw, status: statusRaw, date, amount, note } }
}

export default function CsvImportModal({ onDone }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null) // [{payload?, preview?, error?}]
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null) // {ok, fail}

  const { data: cats = [] } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => api.get('/categories?includeInactive=true').then(r => r.data),
  })

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResults(null)
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'string', raw: false, cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        if (!parsed.length) {
          toast.error('No rows found in file')
          return
        }
        setRows(parsed.map(r => ({ raw: r, ...validateRow(r, cats) })))
      } catch {
        toast.error('Could not read file — make sure it is a valid CSV')
      }
    }
    reader.readAsText(file)
  }

  async function runImport() {
    const valid = rows.filter(r => r.payload)
    if (!valid.length) return
    setImporting(true)
    let ok = 0, fail = 0
    for (const r of valid) {
      try {
        await api.post('/transactions', r.payload)
        ok++
      } catch {
        fail++
      }
    }
    setImporting(false)
    setResults({ ok, fail })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['report'] })
    if (fail === 0) toast.success(`Imported ${ok} transaction${ok === 1 ? '' : 's'}`)
    else toast.error(`Imported ${ok}, ${fail} failed`)
  }

  const validCount = rows?.filter(r => r.payload).length ?? 0
  const errorCount = rows?.filter(r => r.error).length ?? 0

  return (
    <div className="space-y-4">
      {!rows && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Upload a CSV with columns: <code className="text-slate-300">Date, Category, Type, Status, Note, Planned (Rs.), Actual (Rs.)</code>.
            Category names must match an existing category exactly (case-insensitive). This is the same layout produced by
            the Excel export, so an exported file can be re-imported unchanged.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center gap-2 text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
          >
            <UploadCloud className="w-6 h-6" />
            <span className="text-sm">Click to choose a .csv file</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </div>
      )}

      {rows && !results && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> {validCount} ready</span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-400"><XCircle className="w-4 h-4" /> {errorCount} with errors</span>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2 text-left text-slate-500">Row</th>
                  <th className="px-3 py-2 text-left text-slate-500">Category</th>
                  <th className="px-3 py-2 text-left text-slate-500">Type</th>
                  <th className="px-3 py-2 text-left text-slate-500">Date</th>
                  <th className="px-3 py-2 text-right text-slate-500">Amount</th>
                  <th className="px-3 py-2 text-left text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-slate-800/50 ${r.error ? 'bg-red-950/20' : ''}`}>
                    <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                    {r.error ? (
                      <td colSpan={5} className="px-3 py-1.5 text-red-400">{r.error}</td>
                    ) : (
                      <>
                        <td className="px-3 py-1.5 text-slate-300">{r.preview.categoryName}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.preview.type}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.preview.date}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">₹{r.preview.amount.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.preview.status}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              onClick={runImport}
              disabled={importing || validCount === 0}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : `Import ${validCount} transaction${validCount === 1 ? '' : 's'}`}
            </button>
            <button
              onClick={() => setRows(null)}
              disabled={importing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium rounded-lg transition-colors"
            >
              Choose different file
            </button>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-4 text-center py-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-sm text-slate-300">
            Imported <span className="font-semibold text-emerald-400">{results.ok}</span> transaction{results.ok === 1 ? '' : 's'}
            {results.fail > 0 && <> — <span className="font-semibold text-red-400">{results.fail}</span> failed</>}
          </p>
          <button
            onClick={onDone}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
