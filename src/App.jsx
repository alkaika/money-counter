import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_CATEGORIES = ['Sales', 'Services', 'Supplies', 'Food & drink', 'Transport', 'Bills', 'Other'];
const DEFAULT_DENOMINATIONS = ['100', '50', '20', '10', '5', '1', '0.25', '0.10', '0.05', '0.01'];
const DENOMINATION_OPTIONS = ['100', '50', '20', '10', '5', '2', '1', '0.50', '0.25', '0.20', '0.10', '0.05', '0.02', '0.01'];
const CURRENCIES = [
  { symbol: '$', label: 'US Dollar ($)' },
  { symbol: '€', label: 'Euro (€)' },
  { symbol: '£', label: 'British Pound (£)' },
  { symbol: '¥', label: 'Japanese Yen (¥)' },
  { symbol: 'C$', label: 'Canadian Dollar (C$)' },
  { symbol: 'A$', label: 'Australian Dollar (A$)' },
];

function readStored(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The app remains fully usable if storage is unavailable.
  }
}

function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currency(value, symbol = '$') {
  const amount = Number(value || 0);
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '−' : ''}${symbol}${formatted}`;
}

function shortCurrency(value, symbol = '$') {
  const amount = Number(value || 0);
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '−' : ''}${symbol}${formatted}`;
}

function dateLabel(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(`${dateString}T12:00:00`);
  if (date.toDateString() === new Date().toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function timeLabel(createdAt) {
  if (!createdAt) return '';
  return new Date(createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getPrefs() {
  const saved = readStored('moneycounter:prefs', {});
  return {
    currencySymbol: typeof saved.currencySymbol === 'string' ? saved.currencySymbol : '$',
    categories: Array.isArray(saved.categories) ? saved.categories : DEFAULT_CATEGORIES,
    denominations: Array.isArray(saved.denominations) ? saved.denominations : DEFAULT_DENOMINATIONS,
    customCurrencies: Array.isArray(saved.customCurrencies) ? saved.customCurrencies : [],
  };
}

function StatCard({ label, amount, symbol, tone, caption }) {
  const [shown, setShown] = useState(Number(amount || 0));
  const previous = useRef(Number(amount || 0));

  useEffect(() => {
    const start = previous.current;
    const end = Number(amount || 0);
    const started = Date.now();
    const duration = 180;
    let frame;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - started) / duration);
      setShown(start + (end - start) * progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else previous.current = end;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount]);

  const toneClasses = tone === 'green'
    ? 'text-emerald-700'
    : tone === 'red'
      ? 'text-rose-700'
      : 'text-slate-900';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${toneClasses}`}>{currency(shown, symbol)}</p>
      {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
    </section>
  );
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="w-fit rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400">Retry</button>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
    </div>
  );
}

function App() {
  const [prefs, setPrefs] = useState(getPrefs);
  const [darkMode, setDarkMode] = useState(() => readStored('moneycounter:darkMode', false));
  const [activeTab, setActiveTab] = useState('drawer');
  const [transactions, setTransactions] = useState([]);
  const [countsHistory, setCountsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [drawerCounts, setDrawerCounts] = useState(() => readStored('moneycounter:draft', {}));
  const [toast, setToast] = useState('');
  const [transactionModal, setTransactionModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [clearDrawerConfirm, setClearDrawerConfirm] = useState(false);
  const [expandedCount, setExpandedCount] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [formType, setFormType] = useState('in');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(getToday());
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [currencyNameDraft, setCurrencyNameDraft] = useState('');
  const [currencySymbolDraft, setCurrencySymbolDraft] = useState('');
  const [editingCurrency, setEditingCurrency] = useState('');
  const [editCurrencyName, setEditCurrencyName] = useState('');
  const [editCurrencySymbol, setEditCurrencySymbol] = useState('');
  const [renameCategory, setRenameCategory] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [denominationDraft, setDenominationDraft] = useState('');
  const [addingDenomination, setAddingDenomination] = useState(false);
  const [countName, setCountName] = useState('');
  const [countNameOpen, setCountNameOpen] = useState(false);
  const [renameCountTarget, setRenameCountTarget] = useState(null);
  const [renameCountValue, setRenameCountValue] = useState('');
  const [renameCountError, setRenameCountError] = useState('');
  const [renameCountSaving, setRenameCountSaving] = useState(false);
  const [countSaving, setCountSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const refreshTransactions = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setDataError('');
    try {
      if (!window.VPData) throw new Error('Shared ledger is not available right now.');
      const rows = await window.VPData.list('entries');
      setTransactions((Array.isArray(rows) ? rows : []).map(row => ({ ...(row.data || {}), id: row.id })));
    } catch (error) {
      setDataError(error?.message || 'We could not load the transaction ledger.');
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = async (showLoading = false) => {
    if (showLoading) setHistoryLoading(true);
    setHistoryError('');
    try {
      if (!window.VPData) throw new Error('Shared drawer history is not available right now.');
      const rows = await window.VPData.list('drawercounts');
      const normalized = (Array.isArray(rows) ? rows : []).map(row => ({ ...(row.data || {}), id: row.id }));
      normalized.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
      setCountsHistory(normalized);
    } catch (error) {
      setHistoryError(error?.message || 'We could not load drawer count history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshAll = async (showLoading = false) => {
    await Promise.all([refreshTransactions(showLoading), refreshHistory(showLoading)]);
  };

  useEffect(() => {
    refreshHistory(true);
  }, []);

  useEffect(() => {
    writeStored('moneycounter:prefs', prefs);
  }, [prefs]);

  useEffect(() => {
    writeStored('moneycounter:darkMode', darkMode);
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    writeStored('moneycounter:draft', drawerCounts);
  }, [drawerCounts]);

  useEffect(() => {
    if (transactionModal) {
      const onKeyDown = (event) => {
        if (event.key === 'Escape' && !formSaving) {
          setTransactionModal(null);
          setFormError('');
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [transactionModal, formSaving]);

  const symbol = prefs.currencySymbol;
  const currencyOptions = [...CURRENCIES, ...prefs.customCurrencies];
  const transactionCategories = useMemo(() => {
    const fromRows = transactions.map(item => item.category).filter(Boolean);
    return [...new Set([...prefs.categories, ...fromRows])].sort((a, b) => a.localeCompare(b));
  }, [prefs.categories, transactions]);

  const today = getToday();
  const todayTransactions = transactions.filter(item => item.date === today);
  const moneyInToday = todayTransactions.filter(item => item.type === 'in').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const moneyOutToday = todayTransactions.filter(item => item.type === 'out').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const allTimeBalance = transactions.reduce((sum, item) => sum + (item.type === 'in' ? 1 : -1) * Number(item.amount || 0), 0);
  const biggestExpense = transactions.filter(item => item.type === 'out').reduce((biggest, item) => Math.max(biggest, Number(item.amount || 0)), 0);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekday);
  const mostUsedCategory = useMemo(() => {
    const weekTransactions = transactions.filter(item => item.date && new Date(`${item.date}T12:00:00`) >= weekStart);
    const frequencies = {};
    weekTransactions.forEach(item => { frequencies[item.category] = (frequencies[item.category] || 0) + 1; });
    return Object.entries(frequencies).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [transactions]);

  const presets = useMemo(() => {
    const combos = new Map();
    transactions.forEach(item => {
      const amount = Number(item.amount || 0);
      if (!item.category || !amount) return;
      const key = `${item.type}|${item.category}|${amount.toFixed(2)}`;
      const existing = combos.get(key) || { type: item.type, category: item.category, amount, count: 0 };
      existing.count += 1;
      combos.set(key, existing);
    });
    return [...combos.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = transactions.filter(item => {
      const matchesSearch = !needle || `${item.note || ''} ${item.category || ''}`.toLowerCase().includes(needle);
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
    return filtered.sort((a, b) => {
      if (sortOrder === 'largest') return Number(b.amount || 0) - Number(a.amount || 0);
      return new Date(b.date || 0) - new Date(a.date || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [transactions, search, typeFilter, categoryFilter, sortOrder]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map();
    filteredTransactions.forEach(item => {
      const key = item.date || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => ({
      date,
      items,
      net: items.reduce((sum, item) => sum + (item.type === 'in' ? 1 : -1) * Number(item.amount || 0), 0),
    }));
  }, [filteredTransactions]);

  const drawerTotal = prefs.denominations.reduce((sum, denomination) => {
    const pieces = Math.max(0, Number(drawerCounts[denomination] || 0));
    return sum + Number(denomination) * pieces;
  }, 0);

  const openTransactionForm = (preset = null, transaction = null) => {
    setFormError('');
    if (transaction) {
      setFormType(transaction.type || 'in');
      setFormAmount(String(transaction.amount ?? ''));
      setFormCategory(transaction.category || prefs.categories[0] || '');
      setFormNote(transaction.note || '');
      setFormDate(transaction.date || getToday());
      setTransactionModal({ mode: 'edit', transaction });
    } else {
      setFormType(preset?.type || 'in');
      setFormAmount(preset?.amount ? String(preset.amount) : '');
      setFormCategory(preset?.category || prefs.categories[0] || '');
      setFormNote('');
      setFormDate(getToday());
      setTransactionModal({ mode: 'add' });
    }
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    const amount = Number(String(formAmount).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (!formDate) {
      setFormError('Choose a transaction date.');
      return;
    }
    if (!formCategory.trim()) {
      setFormError('Choose a category.');
      return;
    }
    setFormSaving(true);
    setFormError('');
    const record = {
      type: formType,
      amount: Math.round(amount * 100) / 100,
      category: formCategory.trim(),
      note: formNote.trim(),
      date: formDate,
      createdAt: transactionModal?.mode === 'edit'
        ? transactionModal.transaction.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };
    try {
      if (!window.VPData) throw new Error('Shared ledger is unavailable. Please try again.');
      if (transactionModal?.mode === 'edit') {
        await window.VPData.update('entries', transactionModal.transaction.id, record);
        notify('Transaction updated');
      } else {
        await window.VPData.add('entries', record);
        notify('Transaction added');
      }
      await refreshTransactions(false);
      setTransactionModal(null);
    } catch (error) {
      setFormError(error?.message || 'Could not save this transaction. Your entry is still here—please retry.');
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await window.VPData.remove('entries', deleteTarget.id);
      await refreshTransactions(false);
      setDeleteTarget(null);
      notify('Transaction deleted');
    } catch (error) {
      setDataError(error?.message || 'Could not delete that transaction. Please retry.');
    } finally {
      setDeleteSaving(false);
    }
  };

  const saveDrawerCount = async () => {
    if (!prefs.denominations.length) {
      notify('Add denominations in Settings first');
      return;
    }
    setCountSaving(true);
    try {
      if (!window.VPData) throw new Error('Shared drawer history is unavailable. Please try again.');
      const record = {
        counts: { ...drawerCounts },
        total: Math.round(drawerTotal * 100) / 100,
        savedAt: new Date().toISOString(),
        name: countName.trim(),
      };
      await window.VPData.add('drawercounts', record);
      setDrawerCounts({});
      setCountName('');
      setCountNameOpen(false);
      try { window.localStorage.removeItem('moneycounter:draft'); } catch { /* optional storage */ }
      await refreshHistory(false);
      notify('Drawer count saved');
    } catch (error) {
      setHistoryError(error?.message || 'Could not save this count. Your tally is still here—please retry.');
    } finally {
      setCountSaving(false);
    }
  };

  const deleteDrawerCount = async (count) => {
    if (!window.confirm('Delete this saved register count?')) return;
    try {
      if (!window.VPData) throw new Error('Shared drawer history is unavailable. Please try again.');
      await window.VPData.remove('drawercounts', count.id);
      if (expandedCount === count.id) setExpandedCount('');
      await refreshHistory(false);
      notify('Register count deleted');
    } catch (error) {
      setHistoryError(error?.message || 'Could not delete that register count. Please retry.');
    }
  };

  const renameDrawerCount = async (event) => {
    event.preventDefault();
    const name = renameCountValue.trim();
    if (!name) {
      setRenameCountError('Enter a name for this saved count.');
      return;
    }
    if (name.length > 60) {
      setRenameCountError('Keep the name to 60 characters or fewer.');
      return;
    }
    if (!renameCountTarget) return;
    setRenameCountSaving(true);
    setRenameCountError('');
    try {
      if (!window.VPData) throw new Error('Shared drawer history is unavailable. Please try again.');
      await window.VPData.update('drawercounts', renameCountTarget.id, {
        counts: renameCountTarget.counts || {},
        total: Number(renameCountTarget.total || 0),
        difference: Number(renameCountTarget.difference || 0),
        savedAt: renameCountTarget.savedAt,
        name,
      });
      await refreshHistory(false);
      setRenameCountTarget(null);
      notify('Register count renamed');
    } catch (error) {
      setRenameCountError(error?.message || 'Could not rename this saved count. Please try again.');
    } finally {
      setRenameCountSaving(false);
    }
  };

  const changeDrawerCount = (denomination, next) => {
    const value = Math.max(0, Math.floor(Number(next) || 0));
    setDrawerCounts(current => ({ ...current, [denomination]: value }));
  };

  const exportCsv = () => {
    const rows = [
      ['Date', 'Time', 'Type', 'Amount', 'Category', 'Note'],
      ...filteredTransactions.map(item => [
        item.date || '',
        timeLabel(item.createdAt),
        item.type === 'in' ? 'Money In' : 'Money Out',
        Number(item.amount || 0).toFixed(2),
        item.category || '',
        item.note || '',
      ]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerly-transactions-${getToday()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify(`${filteredTransactions.length} transactions exported`);
  };

  const changePrefs = (change) => setPrefs(current => ({ ...current, ...change }));

  const editCustomCurrency = (item) => {
    const suffix = ` (${item.symbol})`;
    setEditingCurrency(item.symbol);
    setEditCurrencyName(item.label.endsWith(suffix) ? item.label.slice(0, -suffix.length) : item.label);
    setEditCurrencySymbol(item.symbol);
  };

  const saveCustomCurrencyEdit = (event) => {
    event.preventDefault();
    const name = editCurrencyName.trim();
    const customSymbol = editCurrencySymbol.trim();
    if (!name || !customSymbol) {
      notify('Enter a currency name and symbol');
      return;
    }
    if (currencyOptions.some(item => item.symbol === customSymbol && item.symbol !== editingCurrency)) {
      notify('That currency symbol is already available');
      return;
    }
    changePrefs({
      customCurrencies: prefs.customCurrencies.map(item => item.symbol === editingCurrency
        ? { symbol: customSymbol, label: `${name} (${customSymbol})` }
        : item),
      currencySymbol: prefs.currencySymbol === editingCurrency ? customSymbol : prefs.currencySymbol,
    });
    setEditingCurrency('');
    notify('Currency updated');
  };

  const addCustomCurrency = (event) => {
    event.preventDefault();
    const name = currencyNameDraft.trim();
    const customSymbol = currencySymbolDraft.trim();
    if (!name || !customSymbol) {
      notify('Enter a currency name and symbol');
      return;
    }
    if (currencyOptions.some(item => item.symbol === customSymbol)) {
      notify('That currency symbol is already available');
      return;
    }
    changePrefs({
      customCurrencies: [...prefs.customCurrencies, { symbol: customSymbol, label: `${name} (${customSymbol})` }],
      currencySymbol: customSymbol,
    });
    setCurrencyNameDraft('');
    setCurrencySymbolDraft('');
    notify('Currency added');
  };

  const addCategory = (event) => {
    event.preventDefault();
    const value = categoryDraft.trim();
    if (!value) return;
    if (prefs.categories.some(category => category.toLowerCase() === value.toLowerCase())) {
      notify('That category already exists');
      return;
    }
    changePrefs({ categories: [...prefs.categories, value] });
    setCategoryDraft('');
    notify('Category added');
  };

  const saveCategoryRename = (event) => {
    event.preventDefault();
    const value = renameValue.trim();
    if (!value || !renameCategory) return;
    if (prefs.categories.some(category => category !== renameCategory && category.toLowerCase() === value.toLowerCase())) {
      notify('That category already exists');
      return;
    }
    changePrefs({ categories: prefs.categories.map(category => category === renameCategory ? value : category) });
    setRenameCategory('');
    setRenameValue('');
    notify('Category renamed');
  };

  const addDenomination = (event) => {
    event.preventDefault();
    const value = Number(denominationDraft);
    if (!Number.isFinite(value) || value <= 0) {
      notify('Enter a denomination greater than zero');
      return;
    }
    const normalized = String(Math.round(value * 100) / 100);
    if (prefs.denominations.includes(normalized)) {
      notify('That denomination is already enabled');
      return;
    }
    changePrefs({ denominations: [...prefs.denominations, normalized].sort((a, b) => Number(b) - Number(a)) });
    setDenominationDraft('');
    setAddingDenomination(false);
    notify('Denomination added');
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setCategoryFilter('all');
  };

  const navItems = [
    { id: 'history', label: 'Register Count History', mark: '▤' },
    { id: 'settings', label: 'Settings', mark: '⚙' },
  ];

  const isFiltered = search || typeFilter !== 'all' || categoryFilter !== 'all';
  const hasTransactions = transactions.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => setActiveTab('drawer')} className="flex items-center gap-2 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">$</span>
            <span>
              <span className="block text-base font-bold tracking-tight">TillCount</span>
              <span className="hidden text-xs text-slate-500 sm:block">Bills and Coins</span>
            </span>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <button type="button" onClick={() => setActiveTab('drawer')} className="rounded-lg bg-indigo-600 px-2 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:px-3.5 sm:text-sm">
              <span className="sm:hidden">Count</span><span className="hidden sm:inline">Count Register Cash</span>
            </button>
            <nav aria-label="Main navigation" className="flex items-center gap-1">
              {navItems.map(item => (
                <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className="rounded-lg bg-indigo-600 px-2 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:px-3.5 sm:text-sm">
                  <span className="md:hidden">{item.id === 'history' ? 'History' : item.label}</span><span className="hidden md:inline">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <button type="button" onClick={() => setDarkMode(mode => !mode)} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} aria-pressed={darkMode} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className={`mx-auto max-w-6xl px-4 pb-64 sm:px-6 md:pb-10 ${activeTab === 'drawer' ? 'pt-2 sm:pt-3' : 'pt-6 sm:pt-8'}`}>
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-indigo-700">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Your money, in focus.</h1>
                <p className="mt-1 text-sm text-slate-500">A clear view of your business cash flow.</p>
              </div>
              <button type="button" onClick={() => setActiveTab('transactions')} className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:block">View transactions →</button>
            </div>

            {dataError && <ErrorBanner message={dataError} onRetry={() => refreshTransactions(true)} />}
            {loading ? <SkeletonCards /> : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard label="Money in today" amount={moneyInToday} symbol={symbol} tone="green" caption="Income recorded today" />
                  <StatCard label="Money out today" amount={moneyOutToday} symbol={symbol} tone="red" caption="Expenses recorded today" />
                  <StatCard label="Net today" amount={moneyInToday - moneyOutToday} symbol={symbol} tone={moneyInToday - moneyOutToday >= 0 ? 'green' : 'red'} caption="Today's money in minus money out" />
                </div>

                <section className="rounded-xl bg-indigo-700 p-5 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <p className="text-sm font-medium text-indigo-100">All-time running balance</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{currency(allTimeBalance, symbol)}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-sm text-indigo-100 sm:mt-0">
                    <span className="rounded-lg bg-white/10 px-3 py-2">Across {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}</span>
                    <span className="hidden rounded-lg bg-white/10 px-3 py-2 sm:inline">Updated live</span>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">Transactions today</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{todayTransactions.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">Biggest expense</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{currency(biggestExpense, symbol)}</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-1">
                    <p className="text-xs font-medium text-slate-500">Top category this week</p>
                    <p className="mt-1 truncate text-xl font-bold">{mostUsedCategory}</p>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">Quick add</h2>
                      <p className="text-sm text-slate-500">Your most-used transaction combos</p>
                    </div>
                    <button type="button" onClick={() => openTransactionForm()} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400">Create new</button>
                  </div>
                  {presets.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {presets.map(preset => (
                        <button key={`${preset.type}-${preset.category}-${preset.amount}`} type="button" onClick={() => openTransactionForm(preset)} className={`rounded-lg border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${preset.type === 'in' ? 'border-emerald-100 bg-emerald-50 hover:bg-emerald-100' : 'border-rose-100 bg-rose-50 hover:bg-rose-100'}`}>
                          <span className={`block text-xs font-semibold ${preset.type === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{preset.category}</span>
                          <span className={`mt-1 block text-sm font-bold tabular-nums ${preset.type === 'in' ? 'text-emerald-800' : 'text-rose-800'}`}>{preset.type === 'in' ? '+' : '−'}{currency(preset.amount, symbol)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">Your most-used entries will appear here as quick-add buttons.</p>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Recent transactions</h2>
                      <p className="text-sm text-slate-500">The latest activity in your ledger</p>
                    </div>
                    <button type="button" onClick={() => setActiveTab('transactions')} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400">View all →</button>
                  </div>
                  {!hasTransactions ? (
                    <EmptyTransactions onAdd={() => openTransactionForm()} />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...transactions].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5).map(item => (
                        <TransactionRow key={item.id} item={item} symbol={symbol} onEdit={() => openTransactionForm(null, item)} onDelete={() => setDeleteTarget(item)} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-indigo-700">Your shared ledger</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Transactions</h1>
                <p className="mt-1 text-sm text-slate-500">Every dollar in and out, all in one place.</p>
              </div>
              <button type="button" onClick={exportCsv} disabled={!filteredTransactions.length} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-400">↓ Export CSV</button>
            </div>

            {dataError && <ErrorBanner message={dataError} onRetry={() => refreshTransactions(true)} />}

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="sm:col-span-2 lg:col-span-1">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Search</span>
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Note or category…" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </label>
                <fieldset>
                  <legend className="mb-1.5 block text-xs font-semibold text-slate-500">Type</legend>
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {[['all', 'All'], ['in', 'In'], ['out', 'Out']].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setTypeFilter(value)} className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${typeFilter === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Category</span>
                  <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                    <option value="all">All categories</option>
                    {transactionCategories.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => setSortOrder(current => current === 'newest' ? 'largest' : 'newest')} className="self-end rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  Sort: {sortOrder === 'newest' ? 'Newest first ↕' : 'Largest amount ↕'}
                </button>
              </div>
            </section>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
              </div>
            ) : !hasTransactions ? (
              <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"><EmptyTransactions onAdd={() => openTransactionForm()} /></section>
            ) : filteredTransactions.length === 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="font-semibold text-slate-800">No transactions match your filters</p>
                <button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-indigo-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">Clear filters</button>
              </section>
            ) : (
              <div className="space-y-4">
                {groupedTransactions.map(group => (
                  <section key={group.date} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <h2 className="text-sm font-bold text-slate-800">{dateLabel(group.date)}</h2>
                      <p className={`text-sm font-semibold tabular-nums ${group.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Daily net {currency(group.net, symbol)}</p>
                    </header>
                    <div className="divide-y divide-slate-100">
                      {group.items.map(item => <TransactionRow key={item.id} item={item} symbol={symbol} onEdit={() => openTransactionForm(null, item)} onDelete={() => setDeleteTarget(item)} />)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'drawer' && (
          <div className="space-y-5">
            {historyError && <ErrorBanner message={historyError} onRetry={() => refreshHistory(true)} />}

            {!prefs.denominations.length ? (
              <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-semibold text-slate-800">No denominations configured</p>
                <p className="mt-1 text-sm text-slate-500">Choose the bills and coins you use in Settings to start counting.</p>
                <button type="button" onClick={() => setActiveTab('settings')} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">Open settings</button>
              </section>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {prefs.denominations.map(denomination => {
                  const pieces = Number(drawerCounts[denomination] || 0);
                  const subtotal = Number(denomination) * pieces;
                  return (
                    <section key={denomination} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Denomination</p>
                          <p className="mt-1 text-xl font-bold tabular-nums">{currency(Number(denomination), symbol)}</p>
                        </div>
                        <p className="text-right text-xs text-slate-500">Subtotal<span className="mt-1 block text-sm font-bold tabular-nums text-slate-800">{currency(subtotal, symbol)}</span></p>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <button type="button" aria-label={`Remove one ${denomination} denomination`} onClick={() => changeDrawerCount(denomination, pieces - 1)} className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-xl font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">−</button>
                        <label className="flex-1">
                          <span className="sr-only">{`Count of ${denomination} denomination`}</span>
                          <input type="number" min="0" step="1" value={pieces || ''} onChange={event => changeDrawerCount(denomination, event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-lg font-semibold tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                        </label>
                        <button type="button" aria-label={`Add one ${denomination} denomination`} onClick={() => changeDrawerCount(denomination, pieces + 1)} className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-xl font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">+</button>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            <section className="fixed inset-x-0 bottom-0 z-10 rounded-t-xl border border-indigo-100 bg-white p-4 shadow-lg md:sticky md:bottom-4 md:rounded-xl md:flex md:items-center md:justify-between md:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Register total</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums text-slate-900">{currency(drawerTotal, symbol)}</p>
                <label className="mt-2 block max-w-sm">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Name this count (optional)</span>
                  <input value={countName} onChange={event => setCountName(event.target.value)} maxLength="60" placeholder="e.g. Friday closing" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </label>
              </div>
              <div className="mt-3 flex gap-2 md:ml-4 md:mt-0">
                <button type="button" onClick={() => setClearDrawerConfirm(true)} disabled={!prefs.denominations.length} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-400 md:flex-none">Clear</button>
                <button type="button" onClick={() => countName.trim() ? saveDrawerCount() : setCountNameOpen(true)} disabled={countSaving || !prefs.denominations.length} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-400 md:flex-none">{countSaving ? 'Saving…' : 'Save register count'}</button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5">
            {historyError && <ErrorBanner message={historyError} onRetry={() => refreshHistory(true)} />}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen} className="flex w-full items-center justify-between px-5 py-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400">
                <span><span className="block font-bold">Register count history</span><span className="mt-0.5 block text-sm text-slate-500">Your saved register snapshots</span></span>
                <span className="text-slate-500">{historyOpen ? '−' : '+'}</span>
              </button>
              {historyOpen && (
                <div className="border-t border-slate-100">
                  {historyLoading ? <div className="flex items-center gap-3 p-5 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />Loading count history…</div> :
                    countsHistory.length === 0 ? <p className="p-5 text-sm text-slate-500">No saved counts yet. Count your drawer and hit Save.</p> :
                      <div className="divide-y divide-slate-100">
                        {countsHistory.map(count => (
                          <div key={count.id}>
                            <div>
                              <button type="button" onClick={() => setExpandedCount(current => current === count.id ? '' : count.id)} aria-expanded={expandedCount === count.id} className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400">
                              <span>
                                <span className="block text-sm font-semibold text-slate-800">{count.name || 'Register count'}</span>
                                <span className="mt-0.5 block text-xs text-slate-500">{new Date(count.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {timeLabel(count.savedAt)} · {Object.values(count.counts || {}).reduce((sum, item) => sum + Number(item || 0), 0)} pieces counted</span>
                              </span>
                              <span className="ml-auto flex items-center gap-3">
                                <span className="text-right"><span className="block font-bold tabular-nums">{currency(count.total, symbol)}</span></span>
                                <span className="text-slate-400">{expandedCount === count.id ? '⌃' : '⌄'}</span>
                              </span>
                              </button>
                              <div className="flex items-center gap-1 px-5 pb-3">
                                <button type="button" onClick={() => { setRenameCountTarget(count); setRenameCountValue(count.name || ''); setRenameCountError(''); }} aria-label={`Rename ${count.name || 'saved register count'}`} className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Rename</button>
                                <button type="button" onClick={() => deleteDrawerCount(count)} aria-label="Delete saved register count" className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400">Delete</button>
                              </div>
                            </div>
                            {expandedCount === count.id && (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-50 px-5 py-4 sm:grid-cols-3">
                                {prefs.denominations.filter(denomination => Number(count.counts?.[denomination] || 0) > 0).map(denomination => (
                                  <div key={denomination} className="flex justify-between text-sm"><span className="text-slate-500">{currency(Number(denomination), symbol)} × {count.counts[denomination]}</span><span className="font-semibold tabular-nums">{currency(Number(denomination) * Number(count.counts[denomination]), symbol)}</span></div>
                                ))}
                                {!Object.values(count.counts || {}).some(value => Number(value) > 0) && <p className="col-span-full text-sm text-slate-500">This count had no pieces entered.</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="mx-auto max-w-3xl space-y-5">
            <div>
              <p className="text-sm font-medium text-indigo-700">Make it yours</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
              <p className="mt-1 text-sm text-slate-500">These preferences are saved on this device.</p>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-bold">Currency</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the symbol shown throughout your ledger.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Default currency</span>
                  <select value={CURRENCIES.some(item => item.symbol === symbol) || !prefs.customCurrencies.some(item => item.symbol === symbol) ? symbol : ''} onChange={event => changePrefs({ currencySymbol: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                    <option value="">Choose a default currency</option>
                    {CURRENCIES.map(item => <option key={item.symbol} value={item.symbol}>{item.label}</option>)}
                    {!currencyOptions.some(item => item.symbol === symbol) && <option value={symbol}>{symbol}</option>}
                  </select>
                </label>
                {prefs.customCurrencies.length > 0 && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-500">Custom currency</span>
                    <select value={prefs.customCurrencies.some(item => item.symbol === symbol) ? symbol : ''} onChange={event => changePrefs({ currencySymbol: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                      <option value="">Choose a custom currency</option>
                      {prefs.customCurrencies.map(item => <option key={item.symbol} value={item.symbol}>{item.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {prefs.customCurrencies.length > 0 && (
                <div className="mt-4 max-w-sm space-y-2">
                  <p className="text-xs font-semibold text-slate-500">Custom currencies</p>
                  {prefs.customCurrencies.map(item => editingCurrency === item.symbol ? (
                    <form key={item.symbol} onSubmit={saveCustomCurrencyEdit} className="space-y-2 rounded-lg border border-slate-200 p-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Currency name</span>
                        <input value={editCurrencyName} onChange={event => setEditCurrencyName(event.target.value)} maxLength="40" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-500">Currency symbol</span>
                        <input value={editCurrencySymbol} onChange={event => setEditCurrencySymbol(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                      </label>
                      <div className="flex gap-2">
                        <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">Save</button>
                        <button type="button" onClick={() => setEditingCurrency('')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div key={item.symbol} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                      <button type="button" onClick={() => editCustomCurrency(item)} className="rounded-md px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Edit</button>
                      <button type="button" onClick={() => { changePrefs({ customCurrencies: prefs.customCurrencies.filter(currency => currency.symbol !== item.symbol), currencySymbol: prefs.currencySymbol === item.symbol ? '$' : prefs.currencySymbol }); notify('Currency deleted'); }} className="rounded-md px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400">Delete</button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={addCustomCurrency} className="mt-4 max-w-sm space-y-2">
                <p className="text-xs font-semibold text-slate-500">Add a country currency</p>
                <label className="block">
                  <span className="sr-only">Currency or country name</span>
                  <input value={currencyNameDraft} onChange={event => setCurrencyNameDraft(event.target.value)} placeholder="e.g. Indian Rupee" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </label>
                <div className="flex gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Currency symbol</span>
                    <input value={currencySymbolDraft} onChange={event => setCurrencySymbolDraft(event.target.value)} placeholder="Symbol, e.g. ₹" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">Add currency</button>
                </div>
              </form>
            </section>

            {false && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-bold">Categories</h2>
                <p className="mt-1 text-sm text-slate-500">Organize money in and out with labels that fit your business.</p>
              </div>
              <div className="space-y-2">
                {prefs.categories.map(category => (
                  <div key={category} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    {renameCategory === category ? (
                      <form onSubmit={saveCategoryRename} className="flex min-w-0 flex-1 gap-2">
                        <label className="sr-only" htmlFor={`rename-${category}`}>Rename {category}</label>
                        <input id={`rename-${category}`} autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
                        <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">Save</button>
                        <button type="button" onClick={() => setRenameCategory('')} className="rounded-md px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{category}</span>
                        <button type="button" onClick={() => { setRenameCategory(category); setRenameValue(category); }} className="rounded-md px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Rename</button>
                        <button type="button" onClick={() => { changePrefs({ categories: prefs.categories.filter(item => item !== category) }); notify('Category removed'); }} className="rounded-md px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-400">Delete</button>
                      </>
                    )}
                  </div>
                ))}
                {!prefs.categories.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No categories yet. Add one below to use it on new transactions.</p>}
              </div>
              <form onSubmit={addCategory} className="mt-4 flex gap-2">
                <label className="sr-only" htmlFor="new-category">New category name</label>
                <input id="new-category" value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} maxLength="40" placeholder="Add a category…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">Add</button>
              </form>
            </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-bold">Register denominations</h2>
                <p className="mt-1 text-sm text-slate-500">Select the bill and coin values used in your cash register.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DENOMINATION_OPTIONS.map(denomination => {
                  const enabled = prefs.denominations.includes(denomination);
                  return (
                    <label key={denomination} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition focus-within:ring-2 focus-within:ring-indigo-300 ${enabled ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={enabled} onChange={event => {
                        const next = event.target.checked
                          ? [...prefs.denominations, denomination].sort((a, b) => Number(b) - Number(a))
                          : prefs.denominations.filter(item => item !== denomination);
                        changePrefs({ denominations: next });
                      }} className="h-4 w-4 accent-indigo-600" />
                      {currency(Number(denomination), symbol)}
                    </label>
                  );
                })}
              </div>
              <div className="mt-4">
                {!addingDenomination ? (
                  <button type="button" onClick={() => setAddingDenomination(true)} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400">+ Add custom denomination</button>
                ) : (
                  <form onSubmit={addDenomination} className="flex flex-wrap gap-2">
                    <label className="sr-only" htmlFor="custom-denomination">Custom denomination amount</label>
                    <input id="custom-denomination" type="number" min="0.01" step="0.01" value={denominationDraft} onChange={event => setDenominationDraft(event.target.value)} placeholder="Amount, e.g. 0.50" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">Add value</button>
                    <button type="button" onClick={() => { setAddingDenomination(false); setDenominationDraft(''); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
                  </form>
                )}
              </div>
            </section>

            <button type="button" onClick={() => changePrefs({ categories: DEFAULT_CATEGORIES, denominations: DEFAULT_DENOMINATIONS, currencySymbol: '$' })} className="text-sm font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">Restore default settings</button>
          </div>
        )}
      </main>

      <nav aria-label="Mobile navigation" className="hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2">
          {navItems.map(item => (
            <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} aria-current={activeTab === item.id ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400 ${activeTab === item.id ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}>
              <span className="text-xl leading-6">{item.mark}</span><span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all md:bottom-6">{toast}</div>}

      {transactionModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !formSaving) setTransactionModal(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="transaction-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="transaction-title" className="text-xl font-bold">{transactionModal.mode === 'edit' ? 'Edit transaction' : 'Add transaction'}</h2>
                <p className="mt-1 text-sm text-slate-500">Keep your cash flow up to date.</p>
              </div>
              <button type="button" onClick={() => { setTransactionModal(null); setFormError(''); }} aria-label="Close form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">×</button>
            </div>
            <form onSubmit={submitTransaction} className="mt-5 space-y-4">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-slate-500">Transaction type</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormType('in')} className={`rounded-lg border px-4 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${formType === 'in' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>↗ Money In</button>
                  <button type="button" onClick={() => setFormType('out')} className={`rounded-lg border px-4 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-rose-400 ${formType === 'out' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>↘ Money Out</button>
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">Amount</span>
                <div className="flex items-center rounded-lg border border-slate-200 px-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                  <span className="text-slate-400">{symbol}</span>
                  <input autoFocus type="text" inputMode="decimal" value={formAmount} onChange={event => { setFormAmount(event.target.value); setFormError(''); }} placeholder="0.00" aria-invalid={!!formError} className="w-full border-0 bg-transparent px-2 py-3 text-lg font-semibold tabular-nums outline-none" />
                </div>
                {formError && <span role="alert" className="mt-1.5 block text-sm text-rose-600">{formError}</span>}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Category</span>
                  <select value={formCategory} onChange={event => setFormCategory(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                    {!transactionCategories.length && <option value="">Add a category in Settings</option>}
                    {transactionCategories.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Date</span>
                  <input type="date" value={formDate} onChange={event => setFormDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">Note <span className="font-normal">(optional)</span></span>
                <input value={formNote} onChange={event => setFormNote(event.target.value)} maxLength="160" placeholder="Add a little detail…" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </label>
              {formError && formError !== 'Enter an amount greater than zero.' && formError !== 'Choose a transaction date.' && formError !== 'Choose a category.' && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={formSaving} onClick={() => setTransactionModal(null)} className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
                <button type="submit" disabled={formSaving} className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-400">{formSaving ? 'Saving…' : transactionModal.mode === 'edit' ? 'Save changes' : 'Add transaction'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-title" className="text-lg font-bold">Delete this transaction?</h2>
            <p className="mt-2 text-sm text-slate-500">This will permanently remove {currency(deleteTarget.amount, symbol)} from the shared ledger.</p>
            {dataError && <p role="alert" className="mt-3 text-sm text-rose-600">{dataError}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={deleteSaving} onClick={() => { setDeleteTarget(null); setDataError(''); }} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
              <button type="button" disabled={deleteSaving} onClick={confirmDeleteTransaction} className="flex-1 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-rose-400">{deleteSaving ? 'Deleting…' : 'Confirm'}</button>
            </div>
          </section>
        </div>
      )}

      {renameCountTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="rename-count-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="rename-count-title" className="text-lg font-bold">Rename saved count</h2>
            <p className="mt-1 text-sm text-slate-500">Give this register snapshot a name you’ll recognize.</p>
            <form onSubmit={renameDrawerCount} className="mt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">Count name</span>
                <input autoFocus value={renameCountValue} onChange={event => { setRenameCountValue(event.target.value); setRenameCountError(''); }} maxLength="60" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </label>
              {renameCountError && <p role="alert" className="mt-2 text-sm text-rose-600">{renameCountError}</p>}
              <div className="mt-5 flex gap-2">
                <button type="button" disabled={renameCountSaving} onClick={() => setRenameCountTarget(null)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
                <button type="submit" disabled={renameCountSaving} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-400">{renameCountSaving ? 'Saving…' : 'Save name'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {countNameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="count-name-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="count-name-title" className="text-lg font-bold">Name this register count</h2>
            <p className="mt-2 text-sm text-slate-500">Add a name for this saved snapshot. The name is optional.</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">Count name</span>
              <input autoFocus value={countName} onChange={event => setCountName(event.target.value)} maxLength="60" placeholder="e.g. Friday closing" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setCountNameOpen(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
              <button type="button" onClick={saveDrawerCount} disabled={countSaving} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-400">{countSaving ? 'Saving…' : 'Save count'}</button>
            </div>
          </section>
        </div>
      )}

      {clearDrawerConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="clear-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="clear-title" className="text-lg font-bold">Clear this drawer count?</h2>
            <p className="mt-2 text-sm text-slate-500">Your current unsaved piece counts will be reset to zero.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setClearDrawerConfirm(false)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">Cancel</button>
              <button type="button" onClick={() => { setDrawerCounts({}); setClearDrawerConfirm(false); notify('Drawer counts cleared'); }} className="flex-1 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400">Clear counts</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyTransactions({ onAdd }) {
  return (
    <div className="py-5 text-center">
      <p className="font-semibold text-slate-800">No transactions yet</p>
      <p className="mt-1 text-sm text-slate-500">Add your first entry to start seeing your cash flow.</p>
      <button type="button" onClick={onAdd} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">Add your first transaction</button>
    </div>
  );
}

function TransactionRow({ item, symbol, onEdit, onDelete }) {
  const isIn = item.type === 'in';
  return (
    <article className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{isIn ? '↗' : '↘'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-semibold text-slate-800">{item.category || 'Uncategorized'}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{isIn ? 'In' : 'Out'}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{item.note || 'No note'}{item.createdAt ? ` · ${timeLabel(item.createdAt)}` : ''}</p>
      </div>
      <p className={`shrink-0 text-right text-sm font-bold tabular-nums ${isIn ? 'text-emerald-700' : 'text-rose-700'}`}>{isIn ? '+' : '−'}{currency(item.amount, symbol)}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={onEdit} aria-label={`Edit transaction in ${item.category || 'category'}`} className="rounded-md p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"><span aria-hidden="true">✎</span></button>
        <button type="button" onClick={onDelete} aria-label={`Delete transaction in ${item.category || 'category'}`} className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400"><span aria-hidden="true">×</span></button>
      </div>
    </article>
  );
}

export default App;
