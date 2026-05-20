import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { Wallet, TrendingUp, TrendingDown, Receipt, Repeat, Tags, LayoutDashboard, Plus, Edit2, Trash2, Check, X, Filter, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock, Calendar, ArrowUpRight, ArrowDownRight, Search, Download, RefreshCw, Upload } from 'lucide-react';

// ============================================================================
// UTILITIES
// ============================================================================

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const toMinor = (rupees) => Math.round(parseFloat(rupees || 0) * 100);
const fromMinor = (minor) => (minor || 0) / 100;
const fmtINR = (minor, opts = {}) => {
  const v = fromMinor(minor);
  const sign = opts.signed && v > 0 ? '+' : '';
  return sign + '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtCompact = (minor) => {
  const v = fromMinor(Math.abs(minor));
  const sign = minor < 0 ? '-' : '';
  if (v >= 10000000) return sign + '₹' + (v / 10000000).toFixed(2) + 'Cr';
  if (v >= 100000) return sign + '₹' + (v / 100000).toFixed(2) + 'L';
  if (v >= 1000) return sign + '₹' + (v / 1000).toFixed(1) + 'K';
  return sign + '₹' + v.toFixed(0);
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => d.toISOString().slice(0, 10);
const parseDate = (iso) => new Date(iso + 'T00:00:00');
const monthLabel = (y, m) => new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const clampDay = (y, m, day) => Math.min(day, daysInMonth(y, m));

const STORAGE_KEY = 'pft_v1_state';

// ============================================================================
// NET WORTH - asset categories and snapshots
// ============================================================================

const DEFAULT_ASSET_CATEGORIES = [
  { id: 'a_hdfc', name: 'HDFC Bank', kind: 'bank', isActive: true, isDefault: true, sortOrder: 1, color: '#3b82f6' },
  { id: 'a_union', name: 'Union Bank', kind: 'bank', isActive: true, isDefault: true, sortOrder: 2, color: '#06b6d4' },
  { id: 'a_sbi', name: 'SBI Bank', kind: 'bank', isActive: true, isDefault: true, sortOrder: 3, color: '#14b8a6' },
  { id: 'a_stock', name: 'Stock', kind: 'investment', isActive: true, isDefault: true, sortOrder: 4, color: '#10b981' },
  { id: 'a_mf', name: 'Mutual Funds', kind: 'investment', isActive: true, isDefault: true, sortOrder: 5, color: '#84cc16' },
  { id: 'a_others', name: 'Others', kind: 'other', isActive: true, isDefault: true, sortOrder: 6, color: '#a78bfa' },
  { id: 'a_cash', name: 'Cash', kind: 'cash', isActive: true, isDefault: true, sortOrder: 7, color: '#f59e0b' },
];

const ASSET_KINDS = [
  { id: 'bank', label: 'Bank' },
  { id: 'investment', label: 'Investment' },
  { id: 'cash', label: 'Cash' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'gold', label: 'Gold / Commodity' },
  { id: 'other', label: 'Other' },
];

// Maps Excel column header to asset id
const EXCEL_ASSET_MAP = {
  'hdfc bank': 'a_hdfc',
  'unian bank': 'a_union', // your typo
  'union bank': 'a_union',
  'sbi bank': 'a_sbi',
  'stock': 'a_stock',
  'mf': 'a_mf',
  'others': 'a_others',
  'cash': 'a_cash',
};

// Parses 'main' sheet -> array of monthly snapshots
function parseMainSheet(rows) {
  // Find header row (one with "Date & Time" or similar)
  let headerRowIdx = -1;
  let headerCols = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const hasDate = row.some(c => c && typeof c === 'string' && /date/i.test(c));
    if (hasDate) {
      headerRowIdx = i;
      headerCols = row.map(cell => {
        if (!cell || typeof cell !== 'string') return null;
        const key = cell.trim().toLowerCase();
        if (/date/i.test(key)) return 'date';
        if (key === 'surplus') return 'surplus';
        if (key === 'total') return 'total';
        if (key.includes('totalreturn') || key.includes('total return')) return 'stockReturn';
        if (key.includes('current total')) return 'currentTotal';
        return EXCEL_ASSET_MAP[key] || null;
      });
      break;
    }
  }
  if (headerRowIdx === -1) return [];
  const snapshots = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const dateIdx = headerCols.indexOf('date');
    const dateCell = row[dateIdx];
    if (!dateCell) continue;
    // Parse date like "1/31/26 0:00" or "2/28/26 15:35" or "3/31/26"
    const dateStr = String(dateCell).trim();
    const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) continue;
    const mo = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += 2000;
    const isoDate = `${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const snapshot = {
      id: uid(),
      date: isoDate,
      year: yr,
      month: mo,
      balancesMinor: {},
      surplusMinor: null,
      stockReturnMinor: null,
      currentTotalMinor: null,
      note: '',
    };
    let anyVal = false;
    for (let c = 0; c < row.length; c++) {
      const tag = headerCols[c];
      if (!tag || tag === 'date') continue;
      const val = parseAmount(row[c]);
      if (val == null) continue;
      anyVal = true;
      if (tag === 'surplus') snapshot.surplusMinor = toMinor(val);
      else if (tag === 'total') {} // ignore — we'll compute it
      else if (tag === 'stockReturn') snapshot.stockReturnMinor = toMinor(val);
      else if (tag === 'currentTotal') snapshot.currentTotalMinor = toMinor(val);
      else snapshot.balancesMinor[tag] = toMinor(val);
    }
    if (anyVal) snapshots.push(snapshot);
  }
  return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}

async function importNetWorthFromExcel(filename = 'EXPENCE.xlsx') {
  const data = await window.fs.readFile(filename);
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'main') || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  return parseMainSheet(rows);
}

function sumBalances(snapshot) {
  return Object.values(snapshot.balancesMinor || {}).reduce((s, v) => s + (v || 0), 0);
}

// Auto-compute surplus and stock returns vs previous snapshot
function computeDerivedMetrics(sortedSnapshots) {
  return sortedSnapshots.map((s, i) => {
    const prev = i > 0 ? sortedSnapshots[i - 1] : null;
    const currentTotal = sumBalances(s);
    const prevTotal = prev ? sumBalances(prev) : 0;
    const computedSurplus = prev ? currentTotal - prevTotal : null;
    const currentStock = s.balancesMinor['a_stock'] || 0;
    const prevStock = prev ? (prev.balancesMinor['a_stock'] || 0) : 0;
    const computedStockReturn = prev ? currentStock - prevStock : null;
    return {
      ...s,
      computedSurplusMinor: computedSurplus,
      computedStockReturnMinor: computedStockReturn,
      computedTotalMinor: currentTotal,
    };
  });
}

// ============================================================================
// DEFAULT DATA / SEED
// ============================================================================

const DEFAULT_CATEGORIES = [
  // Income
  { id: 'c_salary', type: 'INCOME', name: 'Salary', parentId: null, isDefault: true, isActive: true, sortOrder: 1 },
  { id: 'c_side_hustle', type: 'INCOME', name: 'Side Hustle Income', parentId: null, isDefault: true, isActive: true, sortOrder: 2 },
  { id: 'c_freelance', type: 'INCOME', name: 'Freelance', parentId: null, isDefault: true, isActive: true, sortOrder: 3 },
  { id: 'c_invest', type: 'INCOME', name: 'Investments', parentId: null, isDefault: true, isActive: true, sortOrder: 4 },
  { id: 'c_other_inc', type: 'INCOME', name: 'Other Income', parentId: null, isDefault: true, isActive: true, sortOrder: 5 },
  // Expense - matched to your Excel columns
  { id: 'c_loan', type: 'EXPENSE', name: 'Loan', parentId: null, isDefault: true, isActive: true, sortOrder: 1 },
  { id: 'c_housing', type: 'EXPENSE', name: 'Housing & Groceries', parentId: null, isDefault: true, isActive: true, sortOrder: 2 },
  { id: 'c_dining', type: 'EXPENSE', name: 'Dining Out or Food & Drinks', parentId: null, isDefault: true, isActive: true, sortOrder: 3 },
  { id: 'c_healthcare', type: 'EXPENSE', name: 'Healthcare', parentId: null, isDefault: true, isActive: true, sortOrder: 4 },
  { id: 'c_transport', type: 'EXPENSE', name: 'Transport or Commute', parentId: null, isDefault: true, isActive: true, sortOrder: 5 },
  { id: 'c_fitness', type: 'EXPENSE', name: 'Fitness or Recreation', parentId: null, isDefault: true, isActive: true, sortOrder: 6 },
  { id: 'c_social', type: 'EXPENSE', name: 'Social or Entertainment', parentId: null, isDefault: true, isActive: true, sortOrder: 7 },
  { id: 'c_apparel', type: 'EXPENSE', name: 'Apparel or Personal Care', parentId: null, isDefault: true, isActive: true, sortOrder: 8 },
  { id: 'c_household', type: 'EXPENSE', name: 'Household Expenses', parentId: null, isDefault: true, isActive: true, sortOrder: 9 },
  { id: 'c_charity', type: 'EXPENSE', name: 'Charity or Giving', parentId: null, isDefault: true, isActive: true, sortOrder: 10 },
  { id: 'c_invest_loss', type: 'EXPENSE', name: 'Investment Loss', parentId: null, isDefault: true, isActive: true, sortOrder: 11 },
  { id: 'c_subs', type: 'EXPENSE', name: 'Subscriptions & Media', parentId: null, isDefault: true, isActive: true, sortOrder: 12 },
  { id: 'c_misc_loss', type: 'EXPENSE', name: 'Miscellaneous Loss', parentId: null, isDefault: true, isActive: true, sortOrder: 13 },
  { id: 'c_atm', type: 'EXPENSE', name: 'ATM', parentId: null, isDefault: true, isActive: true, sortOrder: 14 },
  { id: 'c_fuel', type: 'EXPENSE', name: 'Fuel & Maintenance', parentId: null, isDefault: true, isActive: true, sortOrder: 15 },
  { id: 'c_other_exp', type: 'EXPENSE', name: 'Other Expense', parentId: null, isDefault: true, isActive: true, sortOrder: 16 },
];

// Maps Excel column header (normalized) to category id
const EXCEL_CATEGORY_MAP = {
  'loan': 'c_loan',
  'housing & groceries': 'c_housing',
  'dining out or food & drinks': 'c_dining',
  'healthcare': 'c_healthcare',
  'transport or commute': 'c_transport',
  'fitness or recreation': 'c_fitness',
  'social or entertainment': 'c_social',
  'apparel or personal care': 'c_apparel',
  'household expenses': 'c_household',
  'charity or giving': 'c_charity',
  'investment loss': 'c_invest_loss',
  'subscriptions & media': 'c_subs',
  'miscellaneous loss': 'c_misc_loss',
  'atm': 'c_atm',
  'fuel & maintenance': 'c_fuel',
  'side hustle income': 'c_side_hustle',
};

// Maps month name to month number
const MONTH_MAP = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};

function parseAmount(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw === 0 ? null : raw;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '₹ -' || s === '₹-') return null;
  // Remove ₹, commas, spaces
  const cleaned = s.replace(/[₹,\s]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return null;
  return num;
}

// Parses the 'monthly expences' sheet into transactions
function parseMonthlyExpensesSheet(rows, year) {
  // rows is array-of-arrays from sheet_to_json(header:1)
  // Strategy: find month-header rows, then read the header (categories) row below it,
  // then read data rows until we hit "Totel" or another month header
  const transactions = [];
  let currentMonth = null;
  let headerCols = null; // array of category ids indexed by column
  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    // Look for a cell containing a month name (in any column)
    let foundMonth = null;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell && typeof cell === 'string') {
        const norm = cell.trim().toLowerCase();
        if (MONTH_MAP[norm]) { foundMonth = MONTH_MAP[norm]; break; }
      }
    }
    if (foundMonth) {
      currentMonth = foundMonth;
      // The NEXT row should be the category header row
      const headerRow = rows[i + 1] || [];
      headerCols = headerRow.map(cell => {
        if (!cell || typeof cell !== 'string') return null;
        const key = cell.trim().toLowerCase();
        return EXCEL_CATEGORY_MAP[key] || null;
      });
      i += 2; // skip month + header rows
      continue;
    }
    // If we have a current month and header, read data row
    if (currentMonth != null && headerCols) {
      // Check if it's a total/summary row — first non-null cell is "Totel" or "Total..." or similar
      const firstNonNull = row.find(c => c != null);
      if (typeof firstNonNull === 'string') {
        const fn = firstNonNull.trim().toLowerCase();
        if (fn === 'totel' || fn === 'total' || fn.startsWith('total sum') || fn === 'important note:' || fn.startsWith('importent') || fn.startsWith('important')) {
          i++;
          continue;
        }
      }
      // Read each cell, match to a category
      for (let c = 0; c < row.length; c++) {
        const catId = headerCols[c];
        if (!catId) continue;
        const amount = parseAmount(row[c]);
        if (amount == null) continue;
        const dateStr = `${year}-${String(currentMonth).padStart(2, '0')}-01`;
        // Side Hustle Income is INCOME (and is stored as negative in sheet)
        const isIncome = catId === 'c_side_hustle';
        const absAmount = Math.abs(amount);
        transactions.push({
          id: uid(),
          type: isIncome ? 'INCOME' : 'EXPENSE',
          categoryId: catId,
          currencyCode: 'INR',
          status: 'ACTUAL',
          expectedAmountMinor: null,
          expectedDate: null,
          actualAmountMinor: toMinor(absAmount),
          actualDate: dateStr,
          note: '',
          recurringRuleId: null,
          occurrenceKey: null,
          createdAt: new Date().toISOString(),
          confirmedAt: new Date().toISOString(),
        });
      }
    }
    i++;
  }
  return transactions;
}

async function importFromExcelFile(filename = 'EXPENCE.xlsx', year = 2026) {
  const data = await window.fs.readFile(filename);
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('monthly')) || wb.SheetNames[1];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  return parseMonthlyExpensesSheet(rows, year);
}

const seedRecurringRules = () => ([]);

const seedManualTransactions = () => [];

function mkTx(type, categoryId, status, expAmt, expDate, actAmt, actDate, note) {
  return {
    id: uid(),
    type, categoryId,
    currencyCode: 'INR',
    status,
    expectedAmountMinor: expAmt,
    expectedDate: expDate,
    actualAmountMinor: actAmt,
    actualDate: actDate,
    note: note || '',
    recurringRuleId: null,
    occurrenceKey: null,
    createdAt: new Date().toISOString(),
    confirmedAt: status === 'ACTUAL' ? new Date().toISOString() : null,
  };
}

// ============================================================================
// RECURRING GENERATION
// ============================================================================

function nextOccurrence(rule, fromDate) {
  const d = new Date(fromDate + 'T00:00:00');
  if (rule.scheduleType === 'MONTHLY') {
    const targetDay = rule.scheduleConfig.dayOfMonth;
    // try same month
    const candidate = new Date(d.getFullYear(), d.getMonth(), clampDay(d.getFullYear(), d.getMonth() + 1, targetDay));
    if (candidate >= d) return ymd(candidate);
    const ny = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const nm = d.getMonth() === 11 ? 0 : d.getMonth() + 1;
    return ymd(new Date(ny, nm, clampDay(ny, nm + 1, targetDay)));
  }
  if (rule.scheduleType === 'WEEKLY') {
    const targetDow = rule.scheduleConfig.dayOfWeek; // 0-6
    const cur = d.getDay();
    let diff = (targetDow - cur + 7) % 7;
    if (diff === 0) diff = 0;
    const c = new Date(d); c.setDate(c.getDate() + diff);
    return ymd(c);
  }
  if (rule.scheduleType === 'YEARLY') {
    const month = rule.scheduleConfig.month; // 1-12
    const day = rule.scheduleConfig.day;
    let y = d.getFullYear();
    const candidate = new Date(y, month - 1, clampDay(y, month, day));
    if (candidate >= d) return ymd(candidate);
    y += 1;
    return ymd(new Date(y, month - 1, clampDay(y, month, day)));
  }
  return ymd(d);
}

function advanceAfter(rule, occurrenceDate) {
  const d = new Date(occurrenceDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return nextOccurrence(rule, ymd(d));
}

function generateRecurring(rules, transactions, throughDate) {
  const through = throughDate || todayISO();
  let generated = 0, skipped = 0, advanced = 0;
  const newTxs = [...transactions];
  const updatedRules = rules.map(rule => {
    if (!rule.isActive) return rule;
    let cursor = rule.nextRunDate;
    let endLimit = rule.endDate && rule.endDate < through ? rule.endDate : through;
    let safety = 200;
    while (cursor <= endLimit && safety-- > 0) {
      const occKey = cursor;
      const exists = newTxs.some(t => t.recurringRuleId === rule.id && t.occurrenceKey === occKey);
      if (!exists) {
        newTxs.push({
          id: uid(),
          type: rule.type,
          categoryId: rule.categoryId,
          currencyCode: rule.currencyCode,
          status: 'EXPECTED',
          expectedAmountMinor: rule.defaultExpectedAmountMinor,
          expectedDate: cursor,
          actualAmountMinor: null,
          actualDate: null,
          note: rule.noteTemplate || '',
          recurringRuleId: rule.id,
          occurrenceKey: occKey,
          createdAt: new Date().toISOString(),
          confirmedAt: null,
        });
        generated++;
      } else {
        skipped++;
      }
      const next = advanceAfter(rule, cursor);
      if (next === cursor) break;
      cursor = next;
    }
    if (cursor !== rule.nextRunDate) advanced++;
    return { ...rule, nextRunDate: cursor };
  });
  return { rules: updatedRules, transactions: newTxs, generated, skipped, advanced };
}

// ============================================================================
// INITIAL STATE
// ============================================================================

function buildEmptyState() {
  return {
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    recurringRules: [],
  };
}

async function buildStateFromExcel() {
  try {
    const txs = await importFromExcelFile('EXPENCE.xlsx', 2026);
    return {
      categories: DEFAULT_CATEGORIES,
      transactions: txs,
      recurringRules: [],
    };
  } catch (e) {
    console.error('Excel import failed:', e);
    return buildEmptyState();
  }
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [state, setState] = useState(null);
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Load: ALWAYS import from Excel first, ignore old storage
  useEffect(() => {
    (async () => {
      setImportStatus('Reading Excel file...');
      try {
        const txs = await importFromExcelFile('EXPENCE.xlsx', 2026);
        const snapshots = await importNetWorthFromExcel('EXPENCE.xlsx');
        setImportStatus(`Imported ${txs.length} transactions, ${snapshots.length} net-worth snapshots`);
        const fresh = {
          categories: DEFAULT_CATEGORIES,
          transactions: txs,
          recurringRules: [],
          assetCategories: DEFAULT_ASSET_CATEGORIES,
          netWorthSnapshots: snapshots,
        };
        // Try to use saved state ONLY if it has the new schema (has assetCategories)
        try {
          const res = await window.storage.get(STORAGE_KEY);
          if (res && res.value) {
            const saved = JSON.parse(res.value);
            const hasNewSchema = saved.assetCategories && saved.netWorthSnapshots;
            if (hasNewSchema && saved.transactions?.length > 0) {
              // Ensure new fields exist for backward compat
              if (!saved.assetCategories) saved.assetCategories = DEFAULT_ASSET_CATEGORIES;
              if (!saved.netWorthSnapshots) saved.netWorthSnapshots = snapshots;
              setState(saved);
              setLoaded(true);
              return;
            }
          }
        } catch {}
        setState(fresh);
        try { await window.storage.set(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
      } catch (e) {
        setImportStatus('Excel import failed: ' + e.message);
        console.error(e);
        setState(buildEmptyState());
      }
      setLoaded(true);
    })();
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded || !state) return;
    (async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(state)); } catch {}
    })();
  }, [state, loaded]);

  const showToast = useCallback((msg, kind = 'success') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 3000);
  }, []);

  const reimportExcel = useCallback(async () => {
    try {
      showToast('Re-importing from Excel...');
      const txs = await importFromExcelFile('EXPENCE.xlsx', 2026);
      const snapshots = await importNetWorthFromExcel('EXPENCE.xlsx');
      const fresh = {
        categories: DEFAULT_CATEGORIES,
        transactions: txs,
        recurringRules: [],
        assetCategories: DEFAULT_ASSET_CATEGORIES,
        netWorthSnapshots: snapshots,
      };
      setState(fresh);
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
      showToast(`Imported ${txs.length} txs · ${snapshots.length} snapshots`);
    } catch (e) {
      showToast('Import failed: ' + e.message, 'error');
      console.error(e);
    }
  }, [showToast]);

  const clearAll = useCallback(async () => {
    const empty = { ...buildEmptyState(), assetCategories: DEFAULT_ASSET_CATEGORIES, netWorthSnapshots: [] };
    setState(empty);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(empty)); } catch {}
    showToast('All data cleared');
  }, [showToast]);

  if (!loaded || !state) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-lg mb-2">Loading Personal Finance Tracker</div>
          <div className="text-sm text-slate-500">{importStatus}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
      <Sidebar view={view} setView={setView} onReimport={reimportExcel} onClear={clearAll} />
      <main className="ml-56 min-h-screen">
        <TopBar state={state} />
        <div className="p-6">
          {view === 'dashboard' && <Dashboard state={state} setState={setState} showToast={showToast} />}
          {view === 'networth' && <NetWorth state={state} setState={setState} showToast={showToast} />}
          {view === 'transactions' && <Transactions state={state} setState={setState} showToast={showToast} />}
          {view === 'recurring' && <Recurring state={state} setState={setState} showToast={showToast} />}
          {view === 'categories' && <Categories state={state} setState={setState} showToast={showToast} />}
          {view === 'quarterly' && <Quarterly state={state} />}
        </div>
      </main>
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-xl text-sm font-medium z-50 ${toast.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SIDEBAR
// ============================================================================

function Sidebar({ view, setView, onReimport, onClear }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'networth', label: 'Net Worth', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'recurring', label: 'Recurring', icon: Repeat },
    { id: 'quarterly', label: 'Quarterly', icon: Calendar },
    { id: 'categories', label: 'Categories', icon: Tags },
  ];
  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-slate-900" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">FinTrack</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Personal Finance</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map(it => {
          const Icon = it.icon;
          const active = view === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{it.label}</span>
              {active && <div className="ml-auto w-1 h-1 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-800 space-y-1">
        <button onClick={onReimport} className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-emerald-400 rounded-md hover:bg-slate-800/50 flex items-center gap-2">
          <Upload className="w-3 h-3" /> Re-import from Excel
        </button>
        <button onClick={onClear} className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800/50 flex items-center gap-2">
          <Trash2 className="w-3 h-3" /> Clear all
        </button>
      </div>
    </aside>
  );
}

// ============================================================================
// TOP BAR
// ============================================================================

function TopBar({ state }) {
  const today = new Date();
  const m = today.getMonth() + 1;
  const y = today.getFullYear();
  const monthData = useMemo(() => computeMonthly(state, y, m), [state, y, m]);

  return (
    <div className="border-b border-slate-800 bg-slate-900/40 backdrop-blur px-6 py-3 flex items-center gap-8">
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">Current Period</div>
        <div className="text-sm font-semibold text-white">{monthLabel(y, m)}</div>
      </div>
      <div className="h-8 w-px bg-slate-800" />
      <QuickStat label="Cash Income" value={fmtCompact(monthData.actualIncomeMinor)} positive />
      <QuickStat label="Cash Expense" value={fmtCompact(monthData.actualExpenseMinor)} negative />
      <QuickStat label="Net Cash" value={fmtCompact(monthData.netActualMinor)} positive={monthData.netActualMinor >= 0} negative={monthData.netActualMinor < 0} />
      <div className="h-8 w-px bg-slate-800" />
      <QuickStat label="Open Expecteds" value={monthData.openExpectedCount} />
      <div className="ml-auto text-xs text-slate-500">{today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  );
}

function QuickStat({ label, value, positive, negative }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${positive ? 'text-emerald-400' : negative ? 'text-rose-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

// ============================================================================
// COMPUTATIONS
// ============================================================================

function computeMonthly(state, year, month) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = daysInMonth(year, month);
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const txs = state.transactions;

  // Cash lens: ACTUAL rows with actual_date in month
  const actualsInMonth = txs.filter(t => t.status === 'ACTUAL' && t.actualDate >= monthStart && t.actualDate <= monthEnd);
  // Plan lens: any row with expected_date in month
  const expectedsInMonth = txs.filter(t => t.expectedDate && t.expectedDate >= monthStart && t.expectedDate <= monthEnd);

  const sumMinor = (arr, type, field) => arr.filter(t => t.type === type).reduce((s, t) => s + (t[field] || 0), 0);

  const actualIncomeMinor = sumMinor(actualsInMonth, 'INCOME', 'actualAmountMinor');
  const actualExpenseMinor = sumMinor(actualsInMonth, 'EXPENSE', 'actualAmountMinor');
  const expectedIncomeMinor = sumMinor(expectedsInMonth, 'INCOME', 'expectedAmountMinor');
  const expectedExpenseMinor = sumMinor(expectedsInMonth, 'EXPENSE', 'expectedAmountMinor');

  const netExpectedMinor = expectedIncomeMinor - expectedExpenseMinor;
  const netActualMinor = actualIncomeMinor - actualExpenseMinor;

  // By category (combined: variance for transactions with expected_date in month)
  const byCategoryMap = new Map();
  const ensureCat = (catId) => {
    if (!byCategoryMap.has(catId)) {
      const cat = state.categories.find(c => c.id === catId);
      byCategoryMap.set(catId, {
        categoryId: catId,
        categoryName: cat ? cat.name : 'Unknown',
        type: cat ? cat.type : 'EXPENSE',
        expectedMinor: 0,
        actualMinor: 0,
      });
    }
    return byCategoryMap.get(catId);
  };
  expectedsInMonth.forEach(t => {
    const c = ensureCat(t.categoryId);
    c.expectedMinor += t.expectedAmountMinor || 0;
    if (t.status === 'ACTUAL') c.actualMinor += t.actualAmountMinor || 0;
  });
  actualsInMonth.forEach(t => {
    // include actuals that didn't have expected_date in month either
    if (!t.expectedDate || t.expectedDate < monthStart || t.expectedDate > monthEnd) {
      const c = ensureCat(t.categoryId);
      c.actualMinor += t.actualAmountMinor || 0;
    }
  });
  const byCategory = Array.from(byCategoryMap.values()).map(c => ({ ...c, varianceMinor: c.actualMinor - c.expectedMinor }));

  // Daily trends
  const dailyActualTrend = [];
  const dailyExpectedTrend = [];
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayActuals = actualsInMonth.filter(t => t.actualDate === ds);
    const dayExpecteds = expectedsInMonth.filter(t => t.expectedDate === ds);
    dailyActualTrend.push({
      date: ds,
      day: d,
      incomeMinor: sumMinor(dayActuals, 'INCOME', 'actualAmountMinor'),
      expenseMinor: sumMinor(dayActuals, 'EXPENSE', 'actualAmountMinor'),
    });
    dailyExpectedTrend.push({
      date: ds,
      day: d,
      incomeMinor: sumMinor(dayExpecteds, 'INCOME', 'expectedAmountMinor'),
      expenseMinor: sumMinor(dayExpecteds, 'EXPENSE', 'expectedAmountMinor'),
    });
  }

  // Cumulative trends
  let cumActIn = 0, cumActEx = 0, cumExpIn = 0, cumExpEx = 0;
  const cumulative = dailyActualTrend.map((d, i) => {
    cumActIn += d.incomeMinor;
    cumActEx += d.expenseMinor;
    cumExpIn += dailyExpectedTrend[i].incomeMinor;
    cumExpEx += dailyExpectedTrend[i].expenseMinor;
    return {
      day: d.day,
      date: d.date,
      cashIn: cumActIn / 100,
      cashOut: cumActEx / 100,
      plannedIn: cumExpIn / 100,
      plannedOut: cumExpEx / 100,
      cashNet: (cumActIn - cumActEx) / 100,
      plannedNet: (cumExpIn - cumExpEx) / 100,
    };
  });

  const openExpectedCount = expectedsInMonth.filter(t => t.status === 'EXPECTED').length;
  const confirmedCount = expectedsInMonth.filter(t => t.status === 'ACTUAL').length;

  return {
    monthStart, monthEnd,
    actualIncomeMinor, actualExpenseMinor,
    expectedIncomeMinor, expectedExpenseMinor,
    netExpectedMinor, netActualMinor,
    byCategory,
    dailyActualTrend,
    dailyExpectedTrend,
    cumulative,
    openExpectedCount,
    confirmedCount,
    actualsInMonth,
    expectedsInMonth,
  };
}

function computeQuarterly(state, year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1;
  const months = [startMonth, startMonth + 1, startMonth + 2];
  const monthly = months.map(m => ({ month: m, label: monthLabel(year, m), data: computeMonthly(state, year, m) }));
  const totals = monthly.reduce((acc, mm) => {
    acc.expectedIncomeMinor += mm.data.expectedIncomeMinor;
    acc.actualIncomeMinor += mm.data.actualIncomeMinor;
    acc.expectedExpenseMinor += mm.data.expectedExpenseMinor;
    acc.actualExpenseMinor += mm.data.actualExpenseMinor;
    return acc;
  }, { expectedIncomeMinor: 0, actualIncomeMinor: 0, expectedExpenseMinor: 0, actualExpenseMinor: 0 });
  totals.netExpectedMinor = totals.expectedIncomeMinor - totals.expectedExpenseMinor;
  totals.netActualMinor = totals.actualIncomeMinor - totals.actualExpenseMinor;

  // By category QTD
  const catMap = new Map();
  monthly.forEach(mm => {
    mm.data.byCategory.forEach(c => {
      if (!catMap.has(c.categoryId)) catMap.set(c.categoryId, { ...c });
      else {
        const ex = catMap.get(c.categoryId);
        ex.expectedMinor += c.expectedMinor;
        ex.actualMinor += c.actualMinor;
        ex.varianceMinor = ex.actualMinor - ex.expectedMinor;
      }
    });
  });
  return { year, quarter, monthly, totals, byCategoryQTD: Array.from(catMap.values()) };
}

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

function Dashboard({ state, setState, showToast }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [lens, setLens] = useState('both'); // 'planned' | 'cash' | 'both'

  const data = useMemo(() => computeMonthly(state, year, month), [state, year, month]);

  const prevMonth = () => {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    setMonth(m); setYear(y);
  };
  const nextMonth = () => {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    setMonth(m); setYear(y);
  };

  // Top categories for pie
  const expenseCatData = data.byCategory.filter(c => c.type === 'EXPENSE' && c.actualMinor > 0)
    .sort((a, b) => b.actualMinor - a.actualMinor).slice(0, 6);

  const PIE_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button onClick={prevMonth} className="px-2 py-1 text-slate-400 hover:text-white rounded">‹</button>
          <div className="px-3 py-1 text-sm font-medium text-white">{monthLabel(year, month)}</div>
          <button onClick={nextMonth} className="px-2 py-1 text-slate-400 hover:text-white rounded">›</button>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {[
            { y: 2026, m: 1, label: 'Jan' },
            { y: 2026, m: 2, label: 'Feb' },
            { y: 2026, m: 3, label: 'Mar' },
            { y: 2026, m: 4, label: 'Apr' },
            { y: 2026, m: 5, label: 'May' },
          ].map(p => {
            const count = state.transactions.filter(t => {
              const d = t.actualDate || t.expectedDate || '';
              return d.startsWith(`${p.y}-${String(p.m).padStart(2,'0')}`);
            }).length;
            const active = year === p.y && month === p.m;
            return (
              <button key={`${p.y}-${p.m}`} onClick={() => { setYear(p.y); setMonth(p.m); }}
                className={`px-2.5 py-1 text-xs rounded flex items-center gap-1.5 ${active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                {p.label}
                {count > 0 && <span className={`text-[9px] px-1 rounded ${active ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{count}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={() => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth() + 1); }}
          className="text-xs text-slate-400 hover:text-white">Today</button>
        <div className="ml-auto flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {['both', 'planned', 'cash'].map(l => (
            <button key={l} onClick={() => setLens(l)}
              className={`px-3 py-1 text-xs rounded ${lens === l ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              {l === 'both' ? 'Both lenses' : l === 'planned' ? 'Planned' : 'Cash'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI title="Planned Income" subtitle="By expected date" value={fmtINR(data.expectedIncomeMinor)} icon={ArrowUpRight} color="emerald" muted />
        <KPI title="Cash Income" subtitle="By actual date" value={fmtINR(data.actualIncomeMinor)} icon={TrendingUp} color="emerald" />
        <KPI title="Planned Expense" subtitle="By expected date" value={fmtINR(data.expectedExpenseMinor)} icon={ArrowDownRight} color="rose" muted />
        <KPI title="Cash Expense" subtitle="By actual date" value={fmtINR(data.actualExpenseMinor)} icon={TrendingDown} color="rose" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <KPI title="Net Planned" value={fmtINR(data.netExpectedMinor, { signed: true })} subtitle="Plan minus plan" color={data.netExpectedMinor >= 0 ? 'emerald' : 'rose'} large muted />
        <KPI title="Net Cash" value={fmtINR(data.netActualMinor, { signed: true })} subtitle="Actual minus actual" color={data.netActualMinor >= 0 ? 'emerald' : 'rose'} large />
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Status Summary</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-slate-400">Open</span>
              </div>
              <div className="text-xl font-bold text-white tabular-nums">{data.openExpectedCount}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-slate-400">Confirmed</span>
              </div>
              <div className="text-xl font-bold text-white tabular-nums">{data.confirmedCount}</div>
            </div>
          </div>
          <div className="mt-2 h-1 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${data.confirmedCount + data.openExpectedCount > 0 ? (data.confirmedCount / (data.confirmedCount + data.openExpectedCount)) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Cumulative Cash Flow</div>
              <div className="text-xs text-slate-500">Planned (dashed) vs Actual cash (solid)</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.cumulative} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                formatter={v => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(lens === 'both' || lens === 'cash') && <Line type="monotone" dataKey="cashIn" stroke="#10b981" strokeWidth={2} dot={false} name="Cash Income" />}
              {(lens === 'both' || lens === 'cash') && <Line type="monotone" dataKey="cashOut" stroke="#ef4444" strokeWidth={2} dot={false} name="Cash Expense" />}
              {(lens === 'both' || lens === 'planned') && <Line type="monotone" dataKey="plannedIn" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Planned Income" />}
              {(lens === 'both' || lens === 'planned') && <Line type="monotone" dataKey="plannedOut" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Planned Expense" />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-1">Expense Mix</div>
          <div className="text-xs text-slate-500 mb-3">Cash by category</div>
          {expenseCatData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={expenseCatData} dataKey="actualMinor" nameKey="categoryName" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {expenseCatData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                    formatter={v => fmtINR(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {expenseCatData.slice(0, 5).map((c, i) => (
                  <div key={c.categoryId} className="flex items-center text-xs">
                    <div className="w-2 h-2 rounded-sm mr-2" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-300 flex-1 truncate">{c.categoryName}</span>
                    <span className="text-slate-400 tabular-nums">{fmtCompact(c.actualMinor)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">No expense data</div>
          )}
        </div>
      </div>

      {/* Variance & open expecteds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Variance by Category</div>
              <div className="text-xs text-slate-500">Planned vs actual cash, this month</div>
            </div>
          </div>
          {data.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byCategory.map(c => ({ ...c, expected: c.expectedMinor / 100, actual: c.actualMinor / 100 }))} margin={{ top: 5, right: 5, bottom: 30, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="categoryName" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" angle={-30} textAnchor="end" height={50} interval={0} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                  formatter={v => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="expected" fill="#475569" name="Planned" radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" fill="#06b6d4" name="Actual" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-xs text-slate-500">No data this month</div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-3">Open Expecteds</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {data.expectedsInMonth.filter(t => t.status === 'EXPECTED').length === 0 && (
              <div className="text-xs text-slate-500 py-4 text-center">All planned items confirmed</div>
            )}
            {data.expectedsInMonth.filter(t => t.status === 'EXPECTED').map(t => {
              const cat = state.categories.find(c => c.id === t.categoryId);
              return (
                <div key={t.id} className="border border-slate-800 rounded-md p-2.5 hover:border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">{cat?.name || '?'}</div>
                      <div className="text-[10px] text-slate-500 truncate">{t.note || '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-semibold tabular-nums ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtCompact(t.expectedAmountMinor)}</div>
                      <div className="text-[10px] text-slate-500">{t.expectedDate}</div>
                    </div>
                  </div>
                  <button onClick={() => quickConfirm(setState, t, showToast)}
                    className="mt-2 w-full text-[10px] py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded">
                    Confirm as actual
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* By-category table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-semibold text-white">Category Breakdown</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2 px-4 font-medium">Category</th>
              <th className="text-left py-2 px-4 font-medium">Type</th>
              <th className="text-right py-2 px-4 font-medium">Planned</th>
              <th className="text-right py-2 px-4 font-medium">Actual</th>
              <th className="text-right py-2 px-4 font-medium">Variance</th>
              <th className="text-right py-2 px-4 font-medium pr-4">% Used</th>
            </tr>
          </thead>
          <tbody>
            {data.byCategory.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-xs text-slate-500">No transactions this month</td></tr>
            )}
            {data.byCategory.sort((a, b) => b.actualMinor - a.actualMinor).map(c => {
              const pct = c.expectedMinor > 0 ? (c.actualMinor / c.expectedMinor) * 100 : 0;
              const overBudget = c.type === 'EXPENSE' && c.varianceMinor > 0;
              return (
                <tr key={c.categoryId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-4 text-slate-200">{c.categoryName}</td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${c.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{c.type}</span>
                  </td>
                  <td className="py-2 px-4 text-right text-slate-400 tabular-nums">{fmtINR(c.expectedMinor)}</td>
                  <td className="py-2 px-4 text-right text-white tabular-nums">{fmtINR(c.actualMinor)}</td>
                  <td className={`py-2 px-4 text-right tabular-nums font-medium ${overBudget ? 'text-rose-400' : c.varianceMinor < 0 && c.type === 'EXPENSE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {c.expectedMinor === 0 ? '—' : fmtINR(c.varianceMinor, { signed: true })}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-slate-400 pr-4">
                    {c.expectedMinor === 0 ? '—' : `${pct.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function quickConfirm(setState, tx, showToast) {
  setState(s => ({
    ...s,
    transactions: s.transactions.map(t => t.id === tx.id ? {
      ...t,
      status: 'ACTUAL',
      actualAmountMinor: t.expectedAmountMinor,
      actualDate: t.expectedDate <= todayISO() ? t.expectedDate : todayISO(),
      confirmedAt: new Date().toISOString(),
    } : t),
  }));
  showToast('Confirmed as actual');
}

function KPI({ title, subtitle, value, icon: Icon, color = 'slate', large, muted }) {
  const colorClasses = {
    emerald: muted ? 'text-emerald-400/60' : 'text-emerald-400',
    rose: muted ? 'text-rose-400/60' : 'text-rose-400',
    slate: 'text-white',
  };
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg p-4 ${muted ? 'opacity-90' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{title}</div>
        {Icon && <Icon className={`w-3.5 h-3.5 ${colorClasses[color]}`} />}
      </div>
      <div className={`${large ? 'text-2xl' : 'text-xl'} font-bold tabular-nums ${colorClasses[color]}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

// ============================================================================
// TRANSACTIONS VIEW
// ============================================================================

function Transactions({ state, setState, showToast }) {
  const [filters, setFilters] = useState({
    from: '', to: '', type: '', categoryId: '', status: '', search: '',
  });
  const [editing, setEditing] = useState(null); // tx object or 'new'
  const [confirming, setConfirming] = useState(null);

  const filtered = useMemo(() => {
    return state.transactions.filter(t => {
      if (filters.type && t.type !== filters.type) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
      const date = t.status === 'ACTUAL' ? t.actualDate : t.expectedDate;
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const cat = state.categories.find(c => c.id === t.categoryId);
        if (!(t.note?.toLowerCase().includes(s) || cat?.name.toLowerCase().includes(s))) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = a.actualDate || a.expectedDate || '';
      const db = b.actualDate || b.expectedDate || '';
      return db.localeCompare(da);
    });
  }, [state.transactions, state.categories, filters]);

  const deleteTx = (id) => {
    if (!confirm('Delete this transaction?')) return;
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
    showToast('Transaction deleted');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Transactions</h1>
          <div className="text-xs text-slate-500">{filtered.length} of {state.transactions.length} entries</div>
        </div>
        <button onClick={() => setEditing('new')} className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input placeholder="Search note..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500" />
        </div>
        <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5">
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5">
          <option value="">All statuses</option>
          <option value="EXPECTED">Expected</option>
          <option value="ACTUAL">Actual</option>
        </select>
        <select value={filters.categoryId} onChange={e => setFilters({ ...filters, categoryId: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5">
          <option value="">All categories</option>
          {state.categories.filter(c => c.isActive).map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.type === 'INCOME' ? 'I' : 'E'})</option>
          ))}
        </select>
        <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5" />
        <input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5" />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50">
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2.5 px-4 font-medium">Date</th>
              <th className="text-left py-2.5 px-4 font-medium">Category</th>
              <th className="text-left py-2.5 px-4 font-medium">Type</th>
              <th className="text-left py-2.5 px-4 font-medium">Status</th>
              <th className="text-right py-2.5 px-4 font-medium">Planned</th>
              <th className="text-right py-2.5 px-4 font-medium">Actual</th>
              <th className="text-left py-2.5 px-4 font-medium">Note</th>
              <th className="text-right py-2.5 px-4 font-medium pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-xs text-slate-500">No matching transactions</td></tr>
            )}
            {filtered.map(t => {
              const cat = state.categories.find(c => c.id === t.categoryId);
              const date = t.status === 'ACTUAL' ? t.actualDate : t.expectedDate;
              return (
                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-4 text-slate-300 tabular-nums">{date}</td>
                  <td className="py-2 px-4 text-slate-200">
                    <div className="flex items-center gap-1.5">
                      {t.recurringRuleId && <Repeat className="w-3 h-3 text-cyan-400" />}
                      {cat?.name || '?'}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${t.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {t.type === 'INCOME' ? 'IN' : 'EX'}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {t.status === 'EXPECTED' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400 flex items-center gap-1 w-fit">
                        <Clock className="w-2.5 h-2.5" /> EXPECTED
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-2.5 h-2.5" /> ACTUAL
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-400 tabular-nums">{t.expectedAmountMinor ? fmtINR(t.expectedAmountMinor) : '—'}</td>
                  <td className={`py-2 px-4 text-right tabular-nums font-medium ${t.actualAmountMinor ? (t.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-600'}`}>
                    {t.actualAmountMinor ? fmtINR(t.actualAmountMinor) : '—'}
                  </td>
                  <td className="py-2 px-4 text-slate-400 text-xs max-w-[200px] truncate">{t.note || '—'}</td>
                  <td className="py-2 px-4 text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {t.status === 'EXPECTED' && (
                        <button onClick={() => setConfirming(t)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" title="Confirm">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setEditing(t)} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteTx(t.id)} className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <TransactionModal
          tx={editing === 'new' ? null : editing}
          categories={state.categories}
          onClose={() => setEditing(null)}
          onSave={(newTx) => {
            setState(s => {
              if (editing === 'new') return { ...s, transactions: [newTx, ...s.transactions] };
              return { ...s, transactions: s.transactions.map(t => t.id === newTx.id ? newTx : t) };
            });
            setEditing(null);
            showToast(editing === 'new' ? 'Transaction created' : 'Transaction updated');
          }}
        />
      )}
      {confirming && (
        <ConfirmModal
          tx={confirming}
          onClose={() => setConfirming(null)}
          onConfirm={(updates) => {
            setState(s => ({
              ...s,
              transactions: s.transactions.map(t => t.id === confirming.id ? {
                ...t,
                status: 'ACTUAL',
                actualAmountMinor: updates.actualAmountMinor,
                actualDate: updates.actualDate,
                note: updates.note ?? t.note,
                confirmedAt: new Date().toISOString(),
              } : t),
            }));
            setConfirming(null);
            showToast('Transaction confirmed');
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// TRANSACTION MODAL (Create/Edit)
// ============================================================================

function TransactionModal({ tx, categories, onClose, onSave }) {
  const [form, setForm] = useState(() => tx ? {
    type: tx.type,
    categoryId: tx.categoryId,
    status: tx.status,
    expectedAmount: tx.expectedAmountMinor != null ? (tx.expectedAmountMinor / 100).toString() : '',
    expectedDate: tx.expectedDate || '',
    actualAmount: tx.actualAmountMinor != null ? (tx.actualAmountMinor / 100).toString() : '',
    actualDate: tx.actualDate || '',
    note: tx.note || '',
  } : {
    type: 'EXPENSE',
    categoryId: '',
    status: 'ACTUAL',
    expectedAmount: '',
    expectedDate: '',
    actualAmount: '',
    actualDate: todayISO(),
    note: '',
  });
  const [errors, setErrors] = useState({});

  const validCats = categories.filter(c => c.isActive && c.type === form.type);

  const handleSubmit = () => {
    const e = {};
    if (!form.categoryId) e.categoryId = 'Required';
    if (form.status === 'EXPECTED') {
      if (!form.expectedAmount || parseFloat(form.expectedAmount) < 0) e.expectedAmount = 'Required';
      if (!form.expectedDate) e.expectedDate = 'Required';
    } else {
      if (!form.actualAmount || parseFloat(form.actualAmount) < 0) e.actualAmount = 'Required';
      if (!form.actualDate) e.actualDate = 'Required';
    }
    if (Object.keys(e).length) { setErrors(e); return; }

    const newTx = tx ? { ...tx } : {
      id: uid(),
      currencyCode: 'INR',
      recurringRuleId: null,
      occurrenceKey: null,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    };
    newTx.type = form.type;
    newTx.categoryId = form.categoryId;
    newTx.status = form.status;
    newTx.expectedAmountMinor = form.expectedAmount ? toMinor(form.expectedAmount) : null;
    newTx.expectedDate = form.expectedDate || null;
    newTx.actualAmountMinor = form.actualAmount ? toMinor(form.actualAmount) : null;
    newTx.actualDate = form.actualDate || null;
    newTx.note = form.note;
    if (form.status === 'ACTUAL' && !newTx.confirmedAt) newTx.confirmedAt = new Date().toISOString();
    onSave(newTx);
  };

  return (
    <Modal title={tx ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Type</label>
            <div className="flex bg-slate-800 rounded p-0.5">
              <button onClick={() => setForm({ ...form, type: 'EXPENSE', categoryId: '' })}
                className={`flex-1 py-1.5 text-xs rounded ${form.type === 'EXPENSE' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>Expense</button>
              <button onClick={() => setForm({ ...form, type: 'INCOME', categoryId: '' })}
                className={`flex-1 py-1.5 text-xs rounded ${form.type === 'INCOME' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Income</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Status</label>
            <div className="flex bg-slate-800 rounded p-0.5">
              <button onClick={() => setForm({ ...form, status: 'ACTUAL' })}
                className={`flex-1 py-1.5 text-xs rounded ${form.status === 'ACTUAL' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Actual</button>
              <button onClick={() => setForm({ ...form, status: 'EXPECTED' })}
                className={`flex-1 py-1.5 text-xs rounded ${form.status === 'EXPECTED' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Expected</button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Category</label>
          <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
            className={`w-full bg-slate-800 border rounded px-2 py-1.5 text-sm text-white ${errors.categoryId ? 'border-rose-500' : 'border-slate-700'}`}>
            <option value="">Select...</option>
            {validCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {form.status === 'EXPECTED' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Expected amount (₹)</label>
              <input type="number" step="0.01" value={form.expectedAmount} onChange={e => setForm({ ...form, expectedAmount: e.target.value })}
                className={`w-full bg-slate-800 border rounded px-2 py-1.5 text-sm text-white ${errors.expectedAmount ? 'border-rose-500' : 'border-slate-700'}`} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Expected date</label>
              <input type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })}
                className={`w-full bg-slate-800 border rounded px-2 py-1.5 text-sm text-white ${errors.expectedDate ? 'border-rose-500' : 'border-slate-700'}`} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Actual amount (₹)</label>
                <input type="number" step="0.01" value={form.actualAmount} onChange={e => setForm({ ...form, actualAmount: e.target.value })}
                  className={`w-full bg-slate-800 border rounded px-2 py-1.5 text-sm text-white ${errors.actualAmount ? 'border-rose-500' : 'border-slate-700'}`} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Actual date</label>
                <input type="date" value={form.actualDate} onChange={e => setForm({ ...form, actualDate: e.target.value })}
                  className={`w-full bg-slate-800 border rounded px-2 py-1.5 text-sm text-white ${errors.actualDate ? 'border-rose-500' : 'border-slate-700'}`} />
              </div>
            </div>
            <details className="text-xs">
              <summary className="text-slate-500 cursor-pointer hover:text-slate-300">Optional: also set expected fields</summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <input type="number" step="0.01" placeholder="Expected ₹" value={form.expectedAmount} onChange={e => setForm({ ...form, expectedAmount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
                <input type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            </details>
          </>
        )}

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Note</label>
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="Optional"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ tx, onClose, onConfirm }) {
  const [actualAmount, setActualAmount] = useState(((tx.expectedAmountMinor || 0) / 100).toString());
  const [actualDate, setActualDate] = useState(tx.expectedDate <= todayISO() ? tx.expectedDate : todayISO());
  const [note, setNote] = useState(tx.note || '');

  return (
    <Modal title="Confirm as actual" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-slate-800/50 border border-slate-800 rounded p-3 text-xs text-slate-400">
          <div>Planned: <span className="text-white tabular-nums">{fmtINR(tx.expectedAmountMinor)}</span> on <span className="text-white">{tx.expectedDate}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Actual amount (₹)</label>
            <input type="number" step="0.01" value={actualAmount} onChange={e => setActualAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Actual date</label>
            <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Note</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={() => onConfirm({ actualAmountMinor: toMinor(actualAmount), actualDate, note })}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Confirm</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// RECURRING VIEW
// ============================================================================

function Recurring({ state, setState, showToast }) {
  const [editing, setEditing] = useState(null);

  const handleGenerate = () => {
    const result = generateRecurring(state.recurringRules, state.transactions, todayISO());
    setState(s => ({ ...s, recurringRules: result.rules, transactions: result.transactions }));
    showToast(`Generated ${result.generated}, skipped ${result.skipped} existing`);
  };

  const deleteRule = (id) => {
    if (!confirm('Delete this recurring rule? Past generated transactions stay.')) return;
    setState(s => ({ ...s, recurringRules: s.recurringRules.filter(r => r.id !== id) }));
    showToast('Rule deleted');
  };

  const toggleActive = (id) => {
    setState(s => ({ ...s, recurringRules: s.recurringRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r) }));
  };

  const formatSchedule = (rule) => {
    if (rule.scheduleType === 'MONTHLY') return `Monthly · Day ${rule.scheduleConfig.dayOfMonth}`;
    if (rule.scheduleType === 'WEEKLY') {
      const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Weekly · ${dows[rule.scheduleConfig.dayOfWeek]}`;
    }
    if (rule.scheduleType === 'YEARLY') return `Yearly · ${rule.scheduleConfig.month}/${rule.scheduleConfig.day}`;
    return rule.scheduleType;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Recurring Rules</h1>
          <div className="text-xs text-slate-500">{state.recurringRules.length} rules · auto-generates on load</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={handleGenerate} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> Generate now
          </button>
          <button onClick={() => setEditing('new')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New rule
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2.5 px-4 font-medium">Status</th>
              <th className="text-left py-2.5 px-4 font-medium">Category</th>
              <th className="text-left py-2.5 px-4 font-medium">Type</th>
              <th className="text-left py-2.5 px-4 font-medium">Schedule</th>
              <th className="text-right py-2.5 px-4 font-medium">Amount</th>
              <th className="text-left py-2.5 px-4 font-medium">Next run</th>
              <th className="text-left py-2.5 px-4 font-medium">Note</th>
              <th className="text-right py-2.5 px-4 font-medium pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.recurringRules.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-xs text-slate-500">No recurring rules. Create one to auto-generate planned transactions.</td></tr>
            )}
            {state.recurringRules.map(r => {
              const cat = state.categories.find(c => c.id === r.categoryId);
              return (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-4">
                    <button onClick={() => toggleActive(r.id)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                      {r.isActive ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </td>
                  <td className="py-2 px-4 text-slate-200">{cat?.name || '?'}</td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {r.type === 'INCOME' ? 'IN' : 'EX'}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-slate-300 text-xs">{formatSchedule(r)}</td>
                  <td className="py-2 px-4 text-right text-white tabular-nums">{fmtINR(r.defaultExpectedAmountMinor)}</td>
                  <td className="py-2 px-4 text-slate-300 tabular-nums">{r.nextRunDate}</td>
                  <td className="py-2 px-4 text-slate-400 text-xs max-w-[200px] truncate">{r.noteTemplate || '—'}</td>
                  <td className="py-2 px-4 text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(r)} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteRule(r.id)} className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-xs text-slate-500 flex gap-3">
        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-slate-300 font-medium">How it works</div>
          <div>Rules generate <span className="text-white">EXPECTED</span> transactions deterministically using occurrence keys, so duplicates are impossible. Day-31 rules clamp to month-end (e.g. Feb 28/29). Editing a rule only affects future runs.</div>
        </div>
      </div>

      {editing && (
        <RuleModal
          rule={editing === 'new' ? null : editing}
          categories={state.categories}
          onClose={() => setEditing(null)}
          onSave={(rule) => {
            setState(s => {
              if (editing === 'new') return { ...s, recurringRules: [...s.recurringRules, rule] };
              return { ...s, recurringRules: s.recurringRules.map(r => r.id === rule.id ? rule : r) };
            });
            setEditing(null);
            showToast(editing === 'new' ? 'Rule created' : 'Rule updated');
          }}
        />
      )}
    </div>
  );
}

function RuleModal({ rule, categories, onClose, onSave }) {
  const [form, setForm] = useState(() => rule ? {
    type: rule.type,
    categoryId: rule.categoryId,
    amount: ((rule.defaultExpectedAmountMinor || 0) / 100).toString(),
    note: rule.noteTemplate || '',
    scheduleType: rule.scheduleType,
    dayOfMonth: rule.scheduleConfig?.dayOfMonth || 1,
    dayOfWeek: rule.scheduleConfig?.dayOfWeek ?? 1,
    yearMonth: rule.scheduleConfig?.month || 1,
    yearDay: rule.scheduleConfig?.day || 1,
    startDate: rule.startDate,
    endDate: rule.endDate || '',
    isActive: rule.isActive,
  } : {
    type: 'EXPENSE',
    categoryId: '',
    amount: '',
    note: '',
    scheduleType: 'MONTHLY',
    dayOfMonth: 1,
    dayOfWeek: 1,
    yearMonth: 1,
    yearDay: 1,
    startDate: todayISO(),
    endDate: '',
    isActive: true,
  });

  const validCats = categories.filter(c => c.isActive && c.type === form.type);

  const handleSubmit = () => {
    if (!form.categoryId || !form.amount) return;
    let scheduleConfig = {};
    if (form.scheduleType === 'MONTHLY') scheduleConfig = { dayOfMonth: Number(form.dayOfMonth) };
    else if (form.scheduleType === 'WEEKLY') scheduleConfig = { dayOfWeek: Number(form.dayOfWeek) };
    else if (form.scheduleType === 'YEARLY') scheduleConfig = { month: Number(form.yearMonth), day: Number(form.yearDay) };

    const baseRule = rule ? { ...rule } : { id: uid() };
    const newRule = {
      ...baseRule,
      type: form.type,
      categoryId: form.categoryId,
      currencyCode: 'INR',
      defaultExpectedAmountMinor: toMinor(form.amount),
      noteTemplate: form.note,
      scheduleType: form.scheduleType,
      scheduleConfig,
      startDate: form.startDate,
      endDate: form.endDate || null,
      isActive: form.isActive,
    };
    if (!rule) {
      newRule.nextRunDate = nextOccurrence(newRule, form.startDate);
    }
    onSave(newRule);
  };

  return (
    <Modal title={rule ? 'Edit rule' : 'New recurring rule'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Type</label>
            <div className="flex bg-slate-800 rounded p-0.5">
              <button onClick={() => setForm({ ...form, type: 'EXPENSE', categoryId: '' })}
                className={`flex-1 py-1.5 text-xs rounded ${form.type === 'EXPENSE' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>Expense</button>
              <button onClick={() => setForm({ ...form, type: 'INCOME', categoryId: '' })}
                className={`flex-1 py-1.5 text-xs rounded ${form.type === 'INCOME' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Income</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Schedule</label>
            <select value={form.scheduleType} onChange={e => setForm({ ...form, scheduleType: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Category</label>
            <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
              <option value="">Select...</option>
              {validCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Amount (₹)</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
          </div>
        </div>

        {form.scheduleType === 'MONTHLY' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Day of month (1-31, clamps to month end)</label>
            <input type="number" min="1" max="31" value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
          </div>
        )}
        {form.scheduleType === 'WEEKLY' && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Day of week</label>
            <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
        )}
        {form.scheduleType === 'YEARLY' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Month</label>
              <input type="number" min="1" max="12" value={form.yearMonth} onChange={e => setForm({ ...form, yearMonth: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Day</label>
              <input type="number" min="1" max="31" value={form.yearDay} onChange={e => setForm({ ...form, yearDay: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Start date</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">End date (optional)</label>
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Note template</label>
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. Monthly rent"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="active" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
          <label htmlFor="active" className="text-xs text-slate-400">Active</label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// CATEGORIES VIEW
// ============================================================================

function Categories({ state, setState, showToast }) {
  const [editing, setEditing] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const grouped = useMemo(() => {
    const visible = state.categories.filter(c => showInactive || c.isActive);
    const result = { INCOME: [], EXPENSE: [] };
    visible.filter(c => !c.parentId).forEach(parent => {
      const children = visible.filter(c => c.parentId === parent.id);
      result[parent.type].push({ ...parent, children });
    });
    return result;
  }, [state.categories, showInactive]);

  const isUsed = (id) => state.transactions.some(t => t.categoryId === id) ||
    state.recurringRules.some(r => r.categoryId === id);

  const deleteCat = (cat) => {
    if (cat.isDefault) {
      showToast('Default categories can only be deactivated', 'error');
      return;
    }
    if (isUsed(cat.id)) {
      if (!confirm('This category is in use. Deactivate it instead?')) return;
      setState(s => ({ ...s, categories: s.categories.map(c => c.id === cat.id ? { ...c, isActive: false } : c) }));
      showToast('Category deactivated');
      return;
    }
    if (!confirm('Delete this category?')) return;
    setState(s => ({ ...s, categories: s.categories.filter(c => c.id !== cat.id && c.parentId !== cat.id) }));
    showToast('Category deleted');
  };

  const toggleActive = (cat) => {
    setState(s => ({ ...s, categories: s.categories.map(c => c.id === cat.id ? { ...c, isActive: !c.isActive } : c) }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Categories</h1>
          <div className="text-xs text-slate-500">{state.categories.filter(c => c.isActive).length} active · {state.categories.filter(c => !c.isActive).length} inactive</div>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <button onClick={() => setEditing('new')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New category
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {['INCOME', 'EXPENSE'].map(type => (
          <div key={type} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <div className="text-sm font-semibold text-white">{type === 'INCOME' ? 'Income' : 'Expense'}</div>
              <div className="text-xs text-slate-500">({grouped[type].length})</div>
            </div>
            <div className="divide-y divide-slate-800/50">
              {grouped[type].length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-500">No categories</div>
              )}
              {grouped[type].map(parent => (
                <div key={parent.id}>
                  <div className={`flex items-center gap-2 px-4 py-2 hover:bg-slate-800/30 ${!parent.isActive ? 'opacity-50' : ''}`}>
                    <div className="text-sm text-slate-200 flex-1">{parent.name}</div>
                    {parent.isDefault && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">DEFAULT</span>}
                    {!parent.isActive && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">INACTIVE</span>}
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => toggleActive(parent)} title={parent.isActive ? 'Deactivate' : 'Activate'}
                        className="p-1 text-slate-500 hover:text-white rounded">
                        {parent.isActive ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditing(parent)} className="p-1 text-slate-500 hover:text-white rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCat(parent)} className="p-1 text-slate-500 hover:text-rose-400 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {parent.children.map(child => (
                    <div key={child.id} className={`flex items-center gap-2 px-4 py-2 pl-8 hover:bg-slate-800/30 bg-slate-900/50 ${!child.isActive ? 'opacity-50' : ''}`}>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <div className="text-sm text-slate-300 flex-1">{child.name}</div>
                      {child.isDefault && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">DEFAULT</span>}
                      {!child.isActive && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">INACTIVE</span>}
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleActive(child)} className="p-1 text-slate-500 hover:text-white rounded">
                          {child.isActive ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setEditing(child)} className="p-1 text-slate-500 hover:text-white rounded">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteCat(child)} className="p-1 text-slate-500 hover:text-rose-400 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CategoryModal
          category={editing === 'new' ? null : editing}
          categories={state.categories}
          onClose={() => setEditing(null)}
          onSave={(cat) => {
            // sibling name uniqueness check
            const dup = state.categories.find(c =>
              c.id !== cat.id && c.type === cat.type && c.parentId === cat.parentId &&
              c.name.toLowerCase() === cat.name.toLowerCase()
            );
            if (dup) { showToast('Duplicate name under same parent/type', 'error'); return; }
            setState(s => {
              if (editing === 'new') return { ...s, categories: [...s.categories, cat] };
              return { ...s, categories: s.categories.map(c => c.id === cat.id ? cat : c) };
            });
            setEditing(null);
            showToast(editing === 'new' ? 'Category created' : 'Category updated');
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, categories, onClose, onSave }) {
  const [form, setForm] = useState(() => category ? {
    name: category.name,
    type: category.type,
    parentId: category.parentId || '',
  } : {
    name: '',
    type: 'EXPENSE',
    parentId: '',
  });

  const parentOptions = categories.filter(c => c.type === form.type && !c.parentId && c.id !== category?.id);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const cat = category ? { ...category } : {
      id: uid(),
      isDefault: false,
      isActive: true,
      sortOrder: 99,
    };
    cat.name = form.name.trim();
    cat.type = form.type;
    cat.parentId = form.parentId || null;
    onSave(cat);
  };

  return (
    <Modal title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Type</label>
          <div className="flex bg-slate-800 rounded p-0.5">
            <button onClick={() => setForm({ ...form, type: 'EXPENSE', parentId: '' })}
              className={`flex-1 py-1.5 text-xs rounded ${form.type === 'EXPENSE' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>Expense</button>
            <button onClick={() => setForm({ ...form, type: 'INCOME', parentId: '' })}
              className={`flex-1 py-1.5 text-xs rounded ${form.type === 'INCOME' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Income</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Parent (optional, one level only)</label>
          <select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
            <option value="">No parent (top-level)</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// QUARTERLY VIEW
// ============================================================================

function Quarterly({ state }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(today.getMonth() / 3) + 1);

  const data = useMemo(() => computeQuarterly(state, year, quarter), [state, year, quarter]);

  const monthChartData = data.monthly.map(m => ({
    month: m.label.split(' ')[0],
    plannedIn: m.data.expectedIncomeMinor / 100,
    actualIn: m.data.actualIncomeMinor / 100,
    plannedOut: m.data.expectedExpenseMinor / 100,
    actualOut: m.data.actualExpenseMinor / 100,
    netCash: m.data.netActualMinor / 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Quarterly Report</h1>
          <div className="text-xs text-slate-500">Q{quarter} {year} · {data.monthly.map(m => m.label.split(' ')[0]).join(' / ')}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex bg-slate-800 rounded p-0.5">
            {[1, 2, 3, 4].map(q => (
              <button key={q} onClick={() => setQuarter(q)}
                className={`px-3 py-1 text-xs rounded ${quarter === q ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Q{q}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI title="Planned Income (QTD)" value={fmtINR(data.totals.expectedIncomeMinor)} color="emerald" muted />
        <KPI title="Cash Income (QTD)" value={fmtINR(data.totals.actualIncomeMinor)} color="emerald" />
        <KPI title="Planned Expense (QTD)" value={fmtINR(data.totals.expectedExpenseMinor)} color="rose" muted />
        <KPI title="Cash Expense (QTD)" value={fmtINR(data.totals.actualExpenseMinor)} color="rose" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <KPI title="Net Planned (QTD)" value={fmtINR(data.totals.netExpectedMinor, { signed: true })} color={data.totals.netExpectedMinor >= 0 ? 'emerald' : 'rose'} large muted />
        <KPI title="Net Cash (QTD)" value={fmtINR(data.totals.netActualMinor, { signed: true })} color={data.totals.netActualMinor >= 0 ? 'emerald' : 'rose'} large />
      </div>

      {/* Monthly comparison chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-white mb-3">Month-by-Month Breakdown</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthChartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#334155" />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
              formatter={v => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="plannedIn" fill="#064e3b" name="Planned Income" radius={[2, 2, 0, 0]} />
            <Bar dataKey="actualIn" fill="#10b981" name="Cash Income" radius={[2, 2, 0, 0]} />
            <Bar dataKey="plannedOut" fill="#7f1d1d" name="Planned Expense" radius={[2, 2, 0, 0]} />
            <Bar dataKey="actualOut" fill="#ef4444" name="Cash Expense" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Month breakdown table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-semibold text-white">Month Detail</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2.5 px-4 font-medium">Month</th>
              <th className="text-right py-2.5 px-4 font-medium">Planned In</th>
              <th className="text-right py-2.5 px-4 font-medium">Cash In</th>
              <th className="text-right py-2.5 px-4 font-medium">Planned Out</th>
              <th className="text-right py-2.5 px-4 font-medium">Cash Out</th>
              <th className="text-right py-2.5 px-4 font-medium">Net Planned</th>
              <th className="text-right py-2.5 px-4 font-medium pr-4">Net Cash</th>
            </tr>
          </thead>
          <tbody>
            {data.monthly.map(m => (
              <tr key={m.month} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-4 text-slate-200 font-medium">{m.label}</td>
                <td className="py-2 px-4 text-right text-slate-400 tabular-nums">{fmtINR(m.data.expectedIncomeMinor)}</td>
                <td className="py-2 px-4 text-right text-emerald-400 tabular-nums">{fmtINR(m.data.actualIncomeMinor)}</td>
                <td className="py-2 px-4 text-right text-slate-400 tabular-nums">{fmtINR(m.data.expectedExpenseMinor)}</td>
                <td className="py-2 px-4 text-right text-rose-400 tabular-nums">{fmtINR(m.data.actualExpenseMinor)}</td>
                <td className={`py-2 px-4 text-right tabular-nums ${m.data.netExpectedMinor >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>{fmtINR(m.data.netExpectedMinor, { signed: true })}</td>
                <td className={`py-2 px-4 text-right tabular-nums font-medium pr-4 ${m.data.netActualMinor >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtINR(m.data.netActualMinor, { signed: true })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800/30 font-semibold">
              <td className="py-2.5 px-4 text-white">Quarter Total</td>
              <td className="py-2.5 px-4 text-right text-slate-300 tabular-nums">{fmtINR(data.totals.expectedIncomeMinor)}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400 tabular-nums">{fmtINR(data.totals.actualIncomeMinor)}</td>
              <td className="py-2.5 px-4 text-right text-slate-300 tabular-nums">{fmtINR(data.totals.expectedExpenseMinor)}</td>
              <td className="py-2.5 px-4 text-right text-rose-400 tabular-nums">{fmtINR(data.totals.actualExpenseMinor)}</td>
              <td className={`py-2.5 px-4 text-right tabular-nums ${data.totals.netExpectedMinor >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>{fmtINR(data.totals.netExpectedMinor, { signed: true })}</td>
              <td className={`py-2.5 px-4 text-right tabular-nums pr-4 ${data.totals.netActualMinor >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtINR(data.totals.netActualMinor, { signed: true })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* QTD by category */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-semibold text-white">By Category (QTD)</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left py-2.5 px-4 font-medium">Category</th>
              <th className="text-left py-2.5 px-4 font-medium">Type</th>
              <th className="text-right py-2.5 px-4 font-medium">Planned QTD</th>
              <th className="text-right py-2.5 px-4 font-medium">Actual QTD</th>
              <th className="text-right py-2.5 px-4 font-medium pr-4">Variance</th>
            </tr>
          </thead>
          <tbody>
            {data.byCategoryQTD.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-xs text-slate-500">No data this quarter</td></tr>
            )}
            {data.byCategoryQTD.sort((a, b) => b.actualMinor - a.actualMinor).map(c => (
              <tr key={c.categoryId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-4 text-slate-200">{c.categoryName}</td>
                <td className="py-2 px-4">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{c.type}</span>
                </td>
                <td className="py-2 px-4 text-right text-slate-400 tabular-nums">{fmtINR(c.expectedMinor)}</td>
                <td className="py-2 px-4 text-right text-white tabular-nums">{fmtINR(c.actualMinor)}</td>
                <td className={`py-2 px-4 text-right tabular-nums pr-4 ${c.varianceMinor > 0 && c.type === 'EXPENSE' ? 'text-rose-400' : c.varianceMinor < 0 && c.type === 'EXPENSE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {c.expectedMinor === 0 ? '—' : fmtINR(c.varianceMinor, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// NET WORTH VIEW
// ============================================================================

function NetWorth({ state, setState, showToast }) {
  const [editingSnapshot, setEditingSnapshot] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showAssetMgr, setShowAssetMgr] = useState(false);

  const snapshots = state.netWorthSnapshots || [];
  const assets = state.assetCategories || [];
  const activeAssets = assets.filter(a => a.isActive);

  const sortedRaw = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const sorted = computeDerivedMetrics(sortedRaw);
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const latestTotal = latest ? sumBalances(latest) : 0;
  const prevTotal = prev ? sumBalances(prev) : 0;
  const monthDelta = latestTotal - prevTotal;
  const monthDeltaPct = prevTotal > 0 ? (monthDelta / prevTotal) * 100 : 0;

  // Build chart data
  const chartData = sorted.map(s => {
    const row = {
      label: new Date(s.date + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      date: s.date,
      total: sumBalances(s) / 100,
    };
    activeAssets.forEach(a => {
      row[a.id] = (s.balancesMinor[a.id] || 0) / 100;
    });
    return row;
  });

  // Latest balance breakdown
  const breakdown = latest ? activeAssets.map(a => ({
    id: a.id,
    name: a.name,
    color: a.color,
    kind: a.kind,
    amountMinor: latest.balancesMinor[a.id] || 0,
    pct: latestTotal > 0 ? ((latest.balancesMinor[a.id] || 0) / latestTotal) * 100 : 0,
  })).sort((x, y) => y.amountMinor - x.amountMinor) : [];

  // Group by kind for sub-totals
  const byKind = {};
  breakdown.forEach(b => {
    if (!byKind[b.kind]) byKind[b.kind] = { kind: b.kind, total: 0, items: [] };
    byKind[b.kind].total += b.amountMinor;
    byKind[b.kind].items.push(b);
  });

  const deleteSnapshot = (id) => {
    setState(s => ({ ...s, netWorthSnapshots: s.netWorthSnapshots.filter(x => x.id !== id) }));
    showToast('Snapshot deleted');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Net Worth</h1>
          <div className="text-xs text-slate-500">{snapshots.length} monthly snapshots · {activeAssets.length} asset buckets</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowAssetMgr(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
            <Tags className="w-4 h-4" /> Asset categories
          </button>
          <button onClick={() => setEditingSnapshot('new')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add snapshot
          </button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-lg p-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Net Worth</div>
          <div className="text-4xl font-bold text-white tabular-nums mt-1">{fmtINR(latestTotal)}</div>
          <div className="text-xs text-slate-500 mt-1">As of {latest ? latest.date : '—'}</div>
          {prev && (
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-sm font-semibold tabular-nums ${monthDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthDelta >= 0 ? '▲' : '▼'} {fmtINR(Math.abs(monthDelta))}
              </span>
              <span className={`text-xs ${monthDelta >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                ({monthDeltaPct >= 0 ? '+' : ''}{monthDeltaPct.toFixed(2)}%)
              </span>
              <span className="text-xs text-slate-500">vs last month</span>
            </div>
          )}
        </div>
        <KPI title="Last Month Surplus" value={latest && latest.computedSurplusMinor != null ? fmtINR(latest.computedSurplusMinor, { signed: true }) : '—'}
          subtitle="Net worth change vs prev month" color={(latest?.computedSurplusMinor ?? 0) >= 0 ? 'emerald' : 'rose'} large />
        <KPI title="Stock Returns" value={latest && latest.computedStockReturnMinor != null ? fmtINR(latest.computedStockReturnMinor, { signed: true }) : '—'}
          subtitle="Stock balance change vs prev month" color={(latest?.computedStockReturnMinor ?? 0) >= 0 ? 'emerald' : 'rose'} large />
      </div>

      {/* Trend chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-white mb-3">Net Worth Trend</div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#334155" />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                formatter={v => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="#ffffff" strokeWidth={3} dot={{ r: 4 }} name="Total Net Worth" />
              {activeAssets.map(a => (
                <Line key={a.id} type="monotone" dataKey={a.id} stroke={a.color} strokeWidth={1.5} dot={{ r: 2 }} name={a.name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-xs text-slate-500">No snapshots yet — add one to see the trend</div>
        )}
      </div>

      {/* Current breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-1">Asset Allocation</div>
          <div className="text-xs text-slate-500 mb-3">Latest snapshot</div>
          {breakdown.filter(b => b.amountMinor > 0).length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={breakdown.filter(b => b.amountMinor > 0)} dataKey="amountMinor" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {breakdown.filter(b => b.amountMinor > 0).map(b => <Cell key={b.id} fill={b.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                    formatter={v => fmtINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">No data</div>
          )}
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-3">Current Balances</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {breakdown.map(b => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: b.color }} />
                <div className="text-sm text-slate-200 flex-1 min-w-0 truncate">{b.name}</div>
                <div className="text-xs text-slate-500 w-20 text-right tabular-nums">{b.pct.toFixed(1)}%</div>
                <div className="text-sm font-semibold text-white tabular-nums w-32 text-right">{fmtINR(b.amountMinor)}</div>
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
              </div>
            ))}
            {breakdown.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">No assets in latest snapshot</div>}
          </div>
          {/* By kind sub-totals */}
          {Object.values(byKind).length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.values(byKind).sort((a, b) => b.total - a.total).map(k => (
                <div key={k.kind} className="text-xs">
                  <div className="text-[10px] text-slate-500 uppercase">{ASSET_KINDS.find(x => x.id === k.kind)?.label || k.kind}</div>
                  <div className="text-sm font-semibold text-white tabular-nums">{fmtCompact(k.total)}</div>
                  <div className="text-[10px] text-slate-500">{latestTotal > 0 ? ((k.total / latestTotal) * 100).toFixed(1) : 0}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Snapshots table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Monthly Snapshots</div>
          <div className="text-xs text-slate-500">{snapshots.length} entries</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left py-2.5 px-4 font-medium">Date</th>
                {activeAssets.map(a => (
                  <th key={a.id} className="text-right py-2.5 px-3 font-medium" style={{ color: a.color }}>{a.name}</th>
                ))}
                <th className="text-right py-2.5 px-3 font-medium text-white">Total</th>
                <th className="text-right py-2.5 px-3 font-medium">Surplus</th>
                <th className="text-right py-2.5 px-3 font-medium">Stock Δ</th>
                <th className="text-right py-2.5 px-4 font-medium pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={activeAssets.length + 5} className="py-8 text-center text-xs text-slate-500">No snapshots</td></tr>
              )}
              {[...sorted].reverse().map((s, idx) => {
                const total = sumBalances(s);
                return (
                  <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 tabular-nums">{s.date}</td>
                    {activeAssets.map(a => (
                      <td key={a.id} className="py-2 px-3 text-right text-slate-300 tabular-nums">
                        {s.balancesMinor[a.id] ? fmtCompact(s.balancesMinor[a.id]) : '—'}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right text-white font-semibold tabular-nums">{fmtCompact(total)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums ${(s.computedSurplusMinor || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.computedSurplusMinor != null ? fmtCompact(s.computedSurplusMinor) : '—'}
                    </td>
                    <td className={`py-2 px-3 text-right tabular-nums ${(s.computedStockReturnMinor || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.computedStockReturnMinor != null ? fmtCompact(s.computedStockReturnMinor) : '—'}
                    </td>
                    <td className="py-2 px-4 text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingSnapshot(s)} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteSnapshot(s.id)} className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingSnapshot && (
        <SnapshotModal
          snapshot={editingSnapshot === 'new' ? null : editingSnapshot}
          assets={activeAssets}
          onClose={() => setEditingSnapshot(null)}
          onSave={(snap) => {
            setState(s => {
              const list = editingSnapshot === 'new'
                ? [...(s.netWorthSnapshots || []), snap]
                : (s.netWorthSnapshots || []).map(x => x.id === snap.id ? snap : x);
              return { ...s, netWorthSnapshots: list };
            });
            setEditingSnapshot(null);
            showToast(editingSnapshot === 'new' ? 'Snapshot added' : 'Snapshot updated');
          }}
        />
      )}

      {showAssetMgr && (
        <AssetManagerModal
          assets={assets}
          snapshots={snapshots}
          onClose={() => setShowAssetMgr(false)}
          onChange={(newAssets) => {
            setState(s => ({ ...s, assetCategories: newAssets }));
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function SnapshotModal({ snapshot, assets, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const balances = {};
    assets.forEach(a => {
      balances[a.id] = snapshot?.balancesMinor[a.id] != null ? (snapshot.balancesMinor[a.id] / 100).toString() : '';
    });
    return {
      date: snapshot?.date || todayISO(),
      balances,
      note: snapshot?.note || '',
    };
  });

  const handleSubmit = () => {
    const balancesMinor = {};
    Object.entries(form.balances).forEach(([k, v]) => {
      if (v !== '' && !isNaN(parseFloat(v))) balancesMinor[k] = toMinor(v);
    });
    const d = new Date(form.date + 'T00:00:00');
    const snap = snapshot ? { ...snapshot } : { id: uid() };
    snap.date = form.date;
    snap.year = d.getFullYear();
    snap.month = d.getMonth() + 1;
    snap.balancesMinor = balancesMinor;
    snap.note = form.note;
    // surplus and stockReturn are auto-computed, no longer stored
    onSave(snap);
  };

  const total = Object.values(form.balances).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <Modal title={snapshot ? 'Edit snapshot' : 'New monthly snapshot'} onClose={onClose}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Snapshot date (typically month-end)</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="border-t border-slate-800 pt-3">
          <div className="text-xs text-slate-400 mb-2 font-medium">Asset balances (₹)</div>
          <div className="space-y-2">
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: a.color }} />
                <label className="text-sm text-slate-300 flex-1 min-w-0 truncate">{a.name}</label>
                <input type="number" step="0.01" value={form.balances[a.id] || ''}
                  onChange={e => setForm({ ...form, balances: { ...form.balances, [a.id]: e.target.value } })}
                  placeholder="0"
                  className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white text-right tabular-nums" />
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">Total</div>
            <div className="text-base font-bold text-white tabular-nums">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-3 bg-slate-800/30 -mx-4 px-4 py-3 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-medium">Surplus & Stock Returns are auto-computed:</span><br/>
              Surplus = this month's total − previous month's total<br/>
              Stock Returns = this month's Stock − previous month's Stock
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Note</label>
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function AssetManagerModal({ assets, snapshots, onClose, onChange, showToast }) {
  const [editing, setEditing] = useState(null);

  const COLOR_PALETTE = ['#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#a78bfa', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#22d3ee', '#f97316'];

  const isUsed = (id) => snapshots.some(s => s.balancesMinor[id] != null && s.balancesMinor[id] !== 0);

  const deleteAsset = (asset) => {
    if (asset.isDefault) {
      showToast('Default assets can only be deactivated', 'error');
      return;
    }
    if (isUsed(asset.id)) {
      onChange(assets.map(a => a.id === asset.id ? { ...a, isActive: false } : a));
      showToast('Asset deactivated (in use)');
      return;
    }
    onChange(assets.filter(a => a.id !== asset.id));
    showToast('Asset deleted');
  };

  const toggleActive = (asset) => {
    onChange(assets.map(a => a.id === asset.id ? { ...a, isActive: !a.isActive } : a));
  };

  return (
    <Modal title="Asset Categories" onClose={onClose}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <div className="text-xs text-slate-500">Manage buckets where your money sits. Examples: bank accounts, stocks, crypto, gold, real estate.</div>
        <div className="space-y-1">
          {assets.map(a => (
            <div key={a.id} className={`flex items-center gap-2 p-2 rounded border border-slate-800 ${!a.isActive ? 'opacity-50' : ''}`}>
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: a.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200">{a.name}</div>
                <div className="text-[10px] text-slate-500">{ASSET_KINDS.find(k => k.id === a.kind)?.label || a.kind}</div>
              </div>
              {a.isDefault && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">DEFAULT</span>}
              {!a.isActive && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">INACTIVE</span>}
              <button onClick={() => toggleActive(a)} className="p-1 text-slate-400 hover:text-white rounded">
                {a.isActive ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(a)} className="p-1 text-slate-400 hover:text-white rounded">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteAsset(a)} className="p-1 text-slate-400 hover:text-rose-400 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setEditing('new')} className="w-full py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> New asset category
        </button>
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">Done</button>
        </div>
      </div>
      {editing && (
        <AssetEditModal
          asset={editing === 'new' ? null : editing}
          existing={assets}
          colors={COLOR_PALETTE}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            if (editing === 'new') onChange([...assets, a]);
            else onChange(assets.map(x => x.id === a.id ? a : x));
            setEditing(null);
            showToast(editing === 'new' ? 'Asset added' : 'Asset updated');
          }}
        />
      )}
    </Modal>
  );
}

function AssetEditModal({ asset, existing, colors, onClose, onSave }) {
  const [form, setForm] = useState(() => asset ? {
    name: asset.name,
    kind: asset.kind,
    color: asset.color,
  } : {
    name: '',
    kind: 'other',
    color: colors[Math.floor(Math.random() * colors.length)],
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const a = asset ? { ...asset } : {
      id: 'a_' + uid(),
      isActive: true,
      isDefault: false,
      sortOrder: existing.length + 1,
    };
    a.name = form.name.trim();
    a.kind = form.kind;
    a.color = form.color;
    onSave(a);
  };

  return (
    <Modal title={asset ? 'Edit asset' : 'New asset category'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Crypto, Gold, ICICI Bank"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Kind</label>
          <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
            {ASSET_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {colors.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                className={`w-7 h-7 rounded transition-transform ${form.color === c ? 'ring-2 ring-white scale-110' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// MODAL WRAPPER
// ============================================================================

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-semibold text-white">{title}</div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}