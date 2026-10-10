import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import { formatCurrency } from '../../lib/format'
import ImportRulesPanel from './ImportRulesPanel'

const DATE_FORMATS = [
  { value: '', label: 'Detect automatically' },
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy' },
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd' },
  { value: 'dd-MM-yyyy', label: 'dd-MM-yyyy' },
  { value: 'dd-MMM-yyyy', label: 'dd-MMM-yyyy' },
]

/** Splits only the first few lines, just to show the user their own columns. */
function peekColumns(text) {
  const firstLine = text.replace(/\r\n/g, '\n').split('\n').find(l => l.trim() !== '')
  if (!firstLine) return []
  return firstLine.split(',').map(s => s.replace(/^"|"$/g, '').trim())
}

function ColumnSelect({ label, value, onChange, columns, allowNone }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
      >
        {allowNone && <option value="">— none —</option>}
        {columns.map((c, i) => (
          <option key={i} value={i}>{i + 1}. {c || '(unnamed)'}</option>
        ))}
      </select>
    </div>
  )
}

export default function BankImportPage() {
  const toast = useToast()
  const fileRef = useRef(null)

  const [file, setFile] = useState(null)
  const [columns, setColumns] = useState([])
  const [hasHeaderRow, setHasHeaderRow] = useState(true)
  const [dateColumn, setDateColumn] = useState(0)
  const [descriptionColumn, setDescriptionColumn] = useState(1)
  const [amountMode, setAmountMode] = useState('single') // 'single' | 'split'
  const [amountColumn, setAmountColumn] = useState(2)
  const [typeColumn, setTypeColumn] = useState(null)
  const [debitColumn, setDebitColumn] = useState(2)
  const [creditColumn, setCreditColumn] = useState(3)
  const [dateFormat, setDateFormat] = useState('')

  const [preview, setPreview] = useState(null)
  const [rowState, setRowState] = useState({}) // lineNumber -> {categoryId, include, saveRule}
  const [result, setResult] = useState(null)

  const { data: cats = [] } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => api.get('/categories?includeInactive=true').then(r => r.data),
  })

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setResult(null)
    setPreview(null)
    setFile(f)
    const reader = new FileReader()
    reader.onload = evt => setColumns(peekColumns(String(evt.target.result)))
    reader.readAsText(f)
  }

  const mapping = useMemo(() => ({
    dateColumn,
    descriptionColumn,
    amountColumn: amountMode === 'single' ? amountColumn : null,
    typeColumn: amountMode === 'single' ? typeColumn : null,
    debitColumn: amountMode === 'split' ? debitColumn : null,
    creditColumn: amountMode === 'split' ? creditColumn : null,
    dateFormat: dateFormat || null,
    hasHeaderRow,
  }), [dateColumn, descriptionColumn, amountMode, amountColumn, typeColumn,
       debitColumn, creditColumn, dateFormat, hasHeaderRow])

  const previewMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('file', file)
      form.append('mapping', new Blob([JSON.stringify(mapping)], { type: 'application/json' }))
      const { data } = await api.post('/import/preview', form)
      return data
    },
    onSuccess: data => {
      setPreview(data)
      // Rows that already exist default to excluded; everything else is in.
      const next = {}
      data.rows.forEach(r => {
        next[r.lineNumber] = {
          categoryId: r.suggestedCategoryId ?? '',
          include: !r.error && !r.duplicate,
          saveRule: false,
        }
      })
      setRowState(next)
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Could not read the file'),
  })

  const commitMutation = useMutation({
    mutationFn: rows => api.post('/import/commit', { rows }).then(r => r.data),
    onSuccess: data => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
      queryClient.invalidateQueries({ queryKey: ['import-rules'] })
      if (data.errors.length) toast.error(`Imported ${data.importedCount}, ${data.errors.length} failed`)
      else toast.success(`Imported ${data.importedCount} transactions`)
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Import failed'),
  })

  function setRow(line, patch) {
    setRowState(s => ({ ...s, [line]: { ...s[line], ...patch } }))
  }

  const selectable = preview?.rows.filter(r => !r.error) ?? []
  const chosen = selectable.filter(r => rowState[r.lineNumber]?.include)
  const missingCategory = chosen.filter(r => !rowState[r.lineNumber]?.categoryId)

  function runImport() {
    const rows = chosen.map(r => {
      const st = rowState[r.lineNumber]
      return {
        date: r.date,
        amountMinor: r.amountMinor,
        type: r.type,
        categoryId: st.categoryId,
        note: r.description?.slice(0, 500) ?? null,
        saveRule: !!st.saveRule,
        ruleKeyword: st.saveRule ? r.description?.slice(0, 120) : null,
      }
    })
    commitMutation.mutate(rows)
  }

  function reset() {
    setFile(null); setColumns([]); setPreview(null); setRowState({}); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Done ──
  if (result) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-xl font-bold text-slate-100">Import Bank Statement</h1>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="text-sm text-slate-300">
            Imported <span className="font-semibold text-emerald-400">{result.importedCount}</span> transactions
            {result.rulesSavedCount > 0 && <> and saved <span className="text-slate-100">{result.rulesSavedCount}</span> category rules</>}.
          </div>
          {result.errors.length > 0 && (
            <div className="text-left bg-rose-950/30 border border-rose-900/40 rounded-lg p-3 space-y-1">
              {result.errors.map((e, i) => <div key={i} className="text-xs text-rose-300">{e}</div>)}
            </div>
          )}
          <button onClick={reset} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
            Import another file
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Import Bank Statement</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Upload the CSV your bank lets you download, tell FinTrack which columns are which, then review every
          row before anything is saved. Rows that match an existing transaction are flagged and left unticked.
          Imported rows are saved as ACTUAL in INR.
        </p>
      </div>

      {/* Step 1 — file */}
      {!file && (
        <div className="max-w-2xl space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-10 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center gap-2 text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
          >
            <UploadCloud className="w-6 h-6" />
            <span className="text-sm">Click to choose a .csv statement</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
          <ImportRulesPanel categories={cats} />
        </div>
      )}

      {/* Step 2 — mapping */}
      {file && !preview && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">{file.name}</div>
              <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300">Choose a different file</button>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={hasHeaderRow} onChange={e => setHasHeaderRow(e.target.checked)}
                     className="rounded border-slate-700 bg-slate-800" />
              First row is a header
            </label>

            <div className="grid grid-cols-2 gap-3">
              <ColumnSelect label="Date column" value={dateColumn} onChange={setDateColumn} columns={columns} />
              <ColumnSelect label="Description column" value={descriptionColumn} onChange={setDescriptionColumn} columns={columns} />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">How are amounts stored?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAmountMode('single')}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${amountMode === 'single' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >One amount column</button>
                <button
                  onClick={() => setAmountMode('split')}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${amountMode === 'split' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >Separate debit / credit</button>
              </div>
            </div>

            {amountMode === 'single' ? (
              <div className="grid grid-cols-2 gap-3">
                <ColumnSelect label="Amount column" value={amountColumn} onChange={setAmountColumn} columns={columns} />
                <ColumnSelect label="Dr/Cr column (optional)" value={typeColumn} onChange={setTypeColumn} columns={columns} allowNone />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ColumnSelect label="Debit (money out)" value={debitColumn} onChange={setDebitColumn} columns={columns} allowNone />
                <ColumnSelect label="Credit (money in)" value={creditColumn} onChange={setCreditColumn} columns={columns} allowNone />
              </div>
            )}

            {amountMode === 'single' && typeColumn == null && (
              <div className="text-xs text-slate-500">
                With no Dr/Cr column, a negative amount is treated as an expense and a positive one as income.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date format</label>
              <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {previewMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading…</> : 'Preview rows'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — preview */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to mapping
            </button>
            <span className="text-slate-400">{preview.totalRows} rows</span>
            <span className="text-emerald-400">{preview.importableRows} new</span>
            {preview.duplicateRows > 0 && <span className="text-amber-400">{preview.duplicateRows} already imported</span>}
            {preview.errorRows > 0 && <span className="text-rose-400">{preview.errorRows} unreadable</span>}
          </div>

          <div className="max-h-[28rem] overflow-y-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left text-slate-500">Description</th>
                  <th className="px-3 py-2 text-right text-slate-500">Amount</th>
                  <th className="px-3 py-2 text-left text-slate-500">Category</th>
                  <th className="px-3 py-2 text-left text-slate-500">Remember</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map(r => {
                  const st = rowState[r.lineNumber] ?? {}
                  if (r.error) {
                    return (
                      <tr key={r.lineNumber} className="border-b border-slate-800/50 bg-rose-950/20">
                        <td className="px-3 py-1.5 text-slate-600">{r.lineNumber}</td>
                        <td colSpan={5} className="px-3 py-1.5 text-rose-400">{r.error}</td>
                      </tr>
                    )
                  }
                  const typeCats = cats.filter(c => c.type === r.type && c.isActive)
                  return (
                    <tr key={r.lineNumber} className={`border-b border-slate-800/50 ${r.duplicate ? 'bg-amber-950/10' : ''}`}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={!!st.include}
                          onChange={e => setRow(r.lineNumber, { include: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-800"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-slate-400 tabular-nums whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-1.5 text-slate-300 max-w-xs truncate" title={r.description}>
                        {r.description}
                        {r.duplicate && (
                          <span className="ml-1.5 text-[10px] text-amber-400 inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> already imported
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${r.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.type === 'INCOME' ? '+' : '−'}{formatCurrency(r.amountMinor)}
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={st.categoryId ?? ''}
                          onChange={e => setRow(r.lineNumber, { categoryId: e.target.value })}
                          className={`px-2 py-1 bg-slate-800 border text-slate-100 text-xs rounded ${
                            st.include && !st.categoryId ? 'border-rose-700' : 'border-slate-700'
                          }`}
                        >
                          <option value="">Pick…</option>
                          {typeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {r.matchedKeyword && (
                          <span className="ml-1.5 text-[10px] text-slate-600" title={`Matched rule "${r.matchedKeyword}"`}>auto</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={!!st.saveRule}
                          disabled={!st.categoryId}
                          onChange={e => setRow(r.lineNumber, { saveRule: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-800 disabled:opacity-30"
                          title="Remember this description → category for future imports"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {missingCategory.length > 0 && (
            <div className="text-xs text-rose-400">
              {missingCategory.length} selected row{missingCategory.length === 1 ? '' : 's'} still need a category.
            </div>
          )}

          <button
            onClick={runImport}
            disabled={commitMutation.isPending || chosen.length === 0 || missingCategory.length > 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            {commitMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
              : `Import ${chosen.length} transaction${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  )
}
