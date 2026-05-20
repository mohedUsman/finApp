export default function KpiCard({ label, value, sub, color = 'slate', icon: Icon, muted }) {
  const colors = {
    green:  muted ? 'text-emerald-400/60' : 'text-emerald-400',
    red:    muted ? 'text-rose-400/60'    : 'text-rose-400',
    blue:   muted ? 'text-blue-400/60'    : 'text-blue-400',
    slate:  'text-white',
    amber:  muted ? 'text-amber-400/60'   : 'text-amber-400',
    emerald: muted ? 'text-emerald-400/60' : 'text-emerald-400',
    rose:   muted ? 'text-rose-400/60'    : 'text-rose-400',
  }
  const cls = colors[color] ?? 'text-white'
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${muted ? 'opacity-90' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
        {Icon && <Icon className={`w-3.5 h-3.5 ${cls}`} />}
      </div>
      <div className={`text-xl font-bold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
