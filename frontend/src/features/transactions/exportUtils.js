import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, monthName } from '../../lib/format'

function todayFileStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function filterLabel(ym, typeFilter, statusFilter) {
  const parts = [`${monthName(ym.month)} ${ym.year}`]
  if (typeFilter)   parts.push(`Type: ${typeFilter}`)
  if (statusFilter) parts.push(`Status: ${statusFilter}`)
  return parts.join(' · ')
}

function toRupees(minor) {
  return minor != null ? Number(minor) / 100 : null
}

function fmtRs(minor) {
  if (minor == null) return '—'
  return `Rs.${(Number(minor) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export function exportToExcel(txList, ym, typeFilter, statusFilter) {
  const HEADERS = [
    'Transaction ID', 'Date', 'Category', 'Type', 'Status',
    'Note', 'Planned (Rs.)', 'Actual (Rs.)', 'Recurring',
  ]

  const rows = txList.map(tx => [
    tx.id,
    formatDate(tx.actualDate ?? tx.expectedDate),
    tx.categoryName ?? '',
    tx.type,
    tx.status,
    tx.note ?? '',
    toRupees(tx.expectedAmountMinor),
    toRupees(tx.actualAmountMinor),
    tx.recurringRuleId ? 'Yes' : 'No',
  ])

  const totalPlanned = txList.reduce((s, t) => s + (Number(t.expectedAmountMinor) || 0), 0)
  const totalActual  = txList.reduce((s, t) => s + (Number(t.actualAmountMinor)   || 0), 0)

  const summaryRow = [
    `Totals — ${txList.length} transactions`,
    '', '', '', '', '',
    toRupees(totalPlanned),
    toRupees(totalActual),
    '',
  ]

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows, [], summaryRow])

  // Bold header + summary (Community Edition: silently ignored; works with Pro)
  const boldStyle = { font: { bold: true } }
  const lastDataRow = rows.length + 2  // 0-indexed: header=0, rows=1..n, blank=n+1, summary=n+2
  HEADERS.forEach((_, c) => {
    const h = XLSX.utils.encode_cell({ r: 0, c })
    const s = XLSX.utils.encode_cell({ r: lastDataRow, c })
    if (ws[h]) ws[h].s = boldStyle
    if (ws[s]) ws[s].s = boldStyle
  })

  // Number format on amount columns (6=Planned, 7=Actual)
  const amountFmt = '#,##0.00'
  for (let r = 1; r <= rows.length + 2; r++) {
    ;[6, 7].forEach(c => {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (ws[addr] && ws[addr].t === 'n') ws[addr].z = amountFmt
    })
  }

  // Auto-fit column widths (based on max content length across all rows)
  const allRows = [HEADERS, ...rows, summaryRow]
  ws['!cols'] = HEADERS.map((_, c) => ({
    wch: Math.min(
      Math.max(...allRows.map(row => String(row[c] ?? '').length)) + 2,
      55
    ),
  }))

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
  XLSX.writeFile(wb, `transactions_${todayFileStr()}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function exportToPdf(txList, ym, typeFilter, statusFilter) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // ── Report header ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(15, 23, 42)
  doc.text('Transaction Report', 14, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${generatedOn}`, 14, 25)
  doc.text(`Filters: ${filterLabel(ym, typeFilter, statusFilter)}`, 14, 31)

  const totalPlanned = txList.reduce((s, t) => s + (Number(t.expectedAmountMinor) || 0), 0)
  const totalActual  = txList.reduce((s, t) => s + (Number(t.actualAmountMinor)   || 0), 0)

  autoTable(doc, {
    startY: 37,
    margin: { top: 10, right: 14, bottom: 16, left: 14 },
    head: [['ID', 'Date', 'Category', 'Type', 'Status', 'Note', 'Planned (Rs.)', 'Actual (Rs.)', 'Recurring']],
    body: [
      ...txList.map(tx => [
        // Truncate UUID to first 13 chars to keep column width manageable
        tx.id ? `${tx.id.substring(0, 13)}…` : '',
        formatDate(tx.actualDate ?? tx.expectedDate),
        tx.categoryName ?? '',
        tx.type,
        tx.status,
        tx.note ?? '',
        fmtRs(tx.expectedAmountMinor),
        fmtRs(tx.actualAmountMinor),
        tx.recurringRuleId ? 'Yes' : 'No',
      ]),
      // Summary row
      [
        { content: `Total: ${txList.length} transactions`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
        { content: fmtRs(totalPlanned), styles: { fontStyle: 'bold', fillColor: [226, 232, 240], halign: 'right' } },
        { content: fmtRs(totalActual),  styles: { fontStyle: 'bold', fillColor: [226, 232, 240], halign: 'right' } },
        { content: '',                  styles: { fillColor: [226, 232, 240] } },
      ],
    ],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: [30, 41, 59],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26 },               // ID (truncated)
      1: { cellWidth: 22 },               // Date
      2: { cellWidth: 30 },               // Category
      3: { cellWidth: 16 },               // Type
      4: { cellWidth: 18 },               // Status
      5: { cellWidth: 'auto' },           // Note — fills remaining space
      6: { cellWidth: 27, halign: 'right' }, // Planned
      7: { cellWidth: 27, halign: 'right' }, // Actual
      8: { cellWidth: 18 },               // Recurring
    },
    styles: { overflow: 'ellipsize', lineColor: [226, 232, 240], lineWidth: 0.1 },
  })

  // Page numbers — must be added after autoTable finishes all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 6, { align: 'center' })
  }

  doc.save(`transactions_${todayFileStr()}.pdf`)
}
