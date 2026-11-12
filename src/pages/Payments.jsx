import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
  XCircle, Smartphone, RefreshCw, Loader2, Plus, Save, Search, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  usePaymentsSummary,
  usePaymentsTransactions,
  usePaymentsDisbursements,
  usePayoutAccount,
} from '../hooks/queries';
import { alertSuccess, alertError, alertWarning } from '../utils/swal';
import { formatMoney } from '../utils/currency';
import './Payments.css';

const fmt = (n, currency = 'UGX') => formatMoney(n, currency);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const PAGE_SIZE = 12;
const normalize = (v) => (v ?? '').toString().toLowerCase().trim();

const STATUS_CONFIG = {
  COMPLETED: { label: 'Completed', icon: CheckCircle2, cls: 'status-completed' },
  PENDING:   { label: 'Pending',   icon: Clock,         cls: 'status-pending' },
  FAILED:    { label: 'Failed',    icon: XCircle,       cls: 'status-failed' },
  CANCELLED: { label: 'Cancelled', icon: XCircle,       cls: 'status-cancelled' },
};

const Payments = () => {
  const queryClient = useQueryClient();
  const { data: summary, isLoading: summaryLoading } = usePaymentsSummary();
  const { data: transactions = [], isLoading: txLoading } = usePaymentsTransactions();
  const { data: disbursements = [], isLoading: disLoading } = usePaymentsDisbursements();
  const { data: payoutAccount } = usePayoutAccount();

  const platformFeePct = summary?.platform_fee_pct ?? null;
  const platformFeeLabel = platformFeePct != null ? `${platformFeePct}%` : 'platform';

  const [tab, setTab] = useState('transactions');
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState('MTN');
  const [accName, setAccName] = useState('');
  const [editPayout, setEditPayout] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  const [txPage, setTxPage] = useState(1);
  const [disPage, setDisPage] = useState(1);
  const [txSearch, setTxSearch] = useState('');
  const [disSearch, setDisSearch] = useState('');
  const [txStatus, setTxStatus] = useState('ALL');
  const [disStatus, setDisStatus] = useState('ALL');
  const [txSort, setTxSort] = useState({ key: 'created_at', direction: 'desc' });
  const [disSort, setDisSort] = useState({ key: 'created_at', direction: 'desc' });

  const loading = summaryLoading && !summary;

  const refreshPayments = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
    [queryClient]
  );

  const handleRefresh = async () => {
    await refreshPayments();
    setLastRefreshedAt(new Date());
  };

  useEffect(() => {
    if (payoutAccount) {
      setPhone(payoutAccount.phone_number || '');
      setProvider(payoutAccount.provider || 'MTN');
      setAccName(payoutAccount.account_name || '');
    }
  }, [payoutAccount]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshPayments();
      setLastRefreshedAt(new Date());
    }, 45000);
    return () => clearInterval(timer);
  }, [refreshPayments]);

  const savePayoutAccount = async (e) => {
    e.preventDefault();
    if (!phone || !accName) {
      alertWarning('Missing Fields', 'Please fill in all payout account details.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/payments/payout-account', {
        phone_number: phone,
        provider,
        account_name: accName,
      });
      await refreshPayments();
      setEditPayout(false);
      alertSuccess('Saved', 'Your payout account has been updated.');
    } catch (err) {
      alertError('Failed', 'Could not save payout account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const providerColors = { MTN: '#ffcc00', AIRTEL: '#ff0000', MPESA: '#4caf50' };

  const sortArrow = (sortState, key) => (
    sortState.key !== key ? '↕' : sortState.direction === 'asc' ? '↑' : '↓'
  );

  const toggleSort = (state, setState, key) => {
    setState((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const filteredTransactions = useMemo(() => {
    const q = normalize(txSearch);
    return transactions.filter((tx) => {
      const statusPass = txStatus === 'ALL' || tx.status === txStatus;
      const searchPass = !q || normalize([
        tx.internal_reference,
        tx.phone_number,
        tx.status,
        tx.yo_transaction_id,
      ].join(' ')).includes(q);
      return statusPass && searchPass;
    });
  }, [transactions, txSearch, txStatus]);

  const filteredDisbursements = useMemo(() => {
    const q = normalize(disSearch);
    return disbursements.filter((d) => {
      const statusPass = disStatus === 'ALL' || d.status === disStatus;
      const searchPass = !q || normalize([
        d.internal_reference,
        d.phone_number,
        d.provider,
        d.status,
      ].join(' ')).includes(q);
      return statusPass && searchPass;
    });
  }, [disbursements, disSearch, disStatus]);

  const txSortValue = (row, key) => {
    if (key === 'amount') return Number(row.amount || 0);
    if (key === 'created_at') return new Date(row.created_at || 0).getTime();
    return normalize(row[key]);
  };

  const disSortValue = (row, key) => {
    if (key === 'gross_amount' || key === 'platform_fee' || key === 'net_amount') return Number(row[key] || 0);
    if (key === 'created_at') return new Date(row.created_at || 0).getTime();
    return normalize(row[key]);
  };

  const sortedTransactions = useMemo(() => {
    const rows = [...filteredTransactions];
    rows.sort((a, b) => {
      const av = txSortValue(a, txSort.key);
      const bv = txSortValue(b, txSort.key);
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return txSort.direction === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredTransactions, txSort]);

  const sortedDisbursements = useMemo(() => {
    const rows = [...filteredDisbursements];
    rows.sort((a, b) => {
      const av = disSortValue(a, disSort.key);
      const bv = disSortValue(b, disSort.key);
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return disSort.direction === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredDisbursements, disSort]);

  useEffect(() => setTxPage(1), [tab, txSearch, txStatus]);
  useEffect(() => setDisPage(1), [tab, disSearch, disStatus]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedTransactions.length / PAGE_SIZE));
    if (txPage > maxPage) setTxPage(maxPage);
  }, [sortedTransactions.length, txPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedDisbursements.length / PAGE_SIZE));
    if (disPage > maxPage) setDisPage(maxPage);
  }, [sortedDisbursements.length, disPage]);

  const txTotalPages = Math.max(1, Math.ceil(sortedTransactions.length / PAGE_SIZE));
  const disTotalPages = Math.max(1, Math.ceil(sortedDisbursements.length / PAGE_SIZE));
  const txStart = (txPage - 1) * PAGE_SIZE;
  const disStart = (disPage - 1) * PAGE_SIZE;
  const txRows = sortedTransactions.slice(txStart, txStart + PAGE_SIZE);
  const disRows = sortedDisbursements.slice(disStart, disStart + PAGE_SIZE);

  const downloadCsv = (filename, headers, rows) => {
    const csvRows = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => {
        const value = row[h] ?? '';
        const clean = String(value).replace(/"/g, '""');
        return `"${clean}"`;
      }).join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTransactionsCsv = () => {
    downloadCsv(
      'payment-transactions.csv',
      ['reference', 'phone', 'amount', 'status', 'yo_ref', 'date'],
      sortedTransactions.map((tx) => ({
        reference: tx.internal_reference,
        phone: tx.phone_number,
        amount: tx.amount,
        status: tx.status,
        yo_ref: tx.yo_transaction_id || '',
        date: tx.created_at,
      }))
    );
  };

  const exportDisbursementsCsv = () => {
    downloadCsv(
      'disbursements-received.csv',
      ['reference', 'gross_amount', 'platform_fee', 'net_amount', 'phone', 'provider', 'status', 'date'],
      sortedDisbursements.map((d) => ({
        reference: d.internal_reference,
        gross_amount: d.gross_amount,
        platform_fee: d.platform_fee,
        net_amount: d.net_amount,
        phone: d.phone_number,
        provider: d.provider,
        status: d.status,
        date: d.created_at,
      }))
    );
  };

  const renderPager = (page, totalPages, onPageChange, totalRows, start) => {
    if (totalRows <= PAGE_SIZE) return null;
    return (
      <div className="pay-pagination">
        <div className="pay-pagination-info">
          Showing {start + 1}-{Math.min(start + PAGE_SIZE, totalRows)} of {totalRows}
        </div>
        <div className="pay-pagination-btns">
          <button disabled={page === 1} onClick={() => onPageChange(page - 1)} className="pay-page-btn"><ChevronLeft size={16} /></button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i + 1}
              onClick={() => onPageChange(i + 1)}
              className={`pay-page-btn ${page === i + 1 ? 'active' : ''}`}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className="pay-page-btn"><ChevronRight size={16} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="payments-page animate-fade">
      {/* Header */}
      <div className="pay-header">
        <div>
          <h1>Payments & Payouts</h1>
          <p>Track your earnings, payment transactions, and disbursement history.</p>
          <div className="pay-refresh-meta">
            Auto-refresh every 45s · Last updated {lastRefreshedAt.toLocaleTimeString()}
          </div>
        </div>
        <button className="btn-refresh" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="pay-summary-grid">
          <div className="pay-card pay-card-total">
            <div className="pay-card-icon"><ArrowDownCircle size={22} /></div>
            <div className="pay-card-info">
              <span className="pay-card-label">Total Collected</span>
              <span className="pay-card-value">{fmt(summary.total_collected)}</span>
            </div>
          </div>
          <div className="pay-card pay-card-earnings">
            <div className="pay-card-icon"><CreditCard size={22} /></div>
            <div className="pay-card-info">
              <span className="pay-card-label">Your Earnings (after {platformFeeLabel} fee)</span>
              <span className="pay-card-value">{fmt(summary.total_earnings)}</span>
            </div>
          </div>
          <div className="pay-card pay-card-pending">
            <div className="pay-card-icon"><Clock size={22} /></div>
            <div className="pay-card-info">
              <span className="pay-card-label">Pending Payout</span>
              <span className="pay-card-value">{fmt(summary.pending_payout)}</span>
            </div>
          </div>
          <div className="pay-card pay-card-disbursed">
            <div className="pay-card-icon"><ArrowUpCircle size={22} /></div>
            <div className="pay-card-info">
              <span className="pay-card-label">Total Disbursed to You</span>
              <span className="pay-card-value">{fmt(summary.total_disbursed)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payout Account Setup */}
      <div className="payout-account-card glass">
        <div className="payout-account-header">
          <div className="payout-header-left">
            <Smartphone size={20} />
            <div>
              <h3>Mobile Money Payout Account</h3>
              <p>This is where admin will send your earnings via YO! Payments.</p>
            </div>
          </div>
          <button className="btn-edit-payout" onClick={() => setEditPayout(!editPayout)}>
            {editPayout ? 'Cancel' : payoutAccount ? 'Edit Account' : <><Plus size={14} /> Set Up Account</>}
          </button>
        </div>

        {!editPayout && payoutAccount ? (
          <div className="payout-account-display">
            <div className="payout-detail-row">
              <span className="payout-detail-label">Account Name</span>
              <span className="payout-detail-value">{payoutAccount.account_name}</span>
            </div>
            <div className="payout-detail-row">
              <span className="payout-detail-label">Phone Number</span>
              <span className="payout-detail-value">{payoutAccount.phone_number}</span>
            </div>
            <div className="payout-detail-row">
              <span className="payout-detail-label">Provider</span>
              <span className="provider-badge" style={{ background: providerColors[payoutAccount.provider] + '22', color: providerColors[payoutAccount.provider], border: `1px solid ${providerColors[payoutAccount.provider]}44` }}>
                {payoutAccount.provider}
              </span>
            </div>
          </div>
        ) : !editPayout && !payoutAccount ? (
          <div className="payout-empty">
            <Smartphone size={36} opacity={0.3} />
            <p>No payout account configured. Click "Set Up Account" to add your mobile money number.</p>
          </div>
        ) : null}

        {editPayout && (
          <form className="payout-form" onSubmit={savePayoutAccount}>
            <div className="payout-form-grid">
              <div className="form-group">
                <label>Account Name</label>
                <input type="text" placeholder="e.g. John Mukasa" value={accName} onChange={e => setAccName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Mobile Number</label>
                <input type="text" placeholder="e.g. 256701234567" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Mobile Provider</label>
                <div className="provider-selector">
                  {['MTN', 'AIRTEL', 'MPESA'].map(p => (
                    <button key={p} type="button"
                      className={`provider-btn ${provider === p ? 'active' : ''}`}
                      style={provider === p ? { background: providerColors[p] + '22', borderColor: providerColors[p], color: providerColors[p] } : {}}
                      onClick={() => setProvider(p)}
                    >{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <button className="btn-save-payout" type="submit" disabled={saving}>
              {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Payout Account</>}
            </button>
          </form>
        )}
      </div>

      {/* Tab Bar */}
      <div className="pay-tabs">
        <button className={`pay-tab ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>
          Payment Transactions ({transactions.length})
        </button>
        <button className={`pay-tab ${tab === 'disbursements' ? 'active' : ''}`} onClick={() => setTab('disbursements')}>
          Disbursements Received ({disbursements.length})
        </button>
      </div>

      {/* Transactions Table */}
      {tab === 'transactions' && (
        loading ? (
          <div className="pay-loading"><Loader2 size={24} className="spin" /> Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="pay-empty glass">
            <CreditCard size={40} opacity={0.3} />
            <h3>No Transactions Yet</h3>
            <p>Payment transactions will appear here when customers pay for orders.</p>
          </div>
        ) : (
          <div className="pay-table-wrapper glass">
            <div className="pay-table-tools">
              <div className="pay-search-wrap">
                <Search size={16} />
                <input
                  className="pay-search-input"
                  type="search"
                  placeholder="Search reference, phone, status, YO ref..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                />
              </div>
              <div className="pay-tools-right">
                <select className="pay-filter-select" value={txStatus} onChange={(e) => setTxStatus(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button className="pay-export-btn" onClick={exportTransactionsCsv}>
                  <Download size={15} /> Export CSV
                </button>
              </div>
            </div>
            <table className="pay-table">
              <thead>
                <tr>
                  <th><button className={`pay-sort-head ${txSort.key === 'internal_reference' ? 'active' : ''}`} onClick={() => toggleSort(txSort, setTxSort, 'internal_reference')}>Reference {sortArrow(txSort, 'internal_reference')}</button></th>
                  <th><button className={`pay-sort-head ${txSort.key === 'phone_number' ? 'active' : ''}`} onClick={() => toggleSort(txSort, setTxSort, 'phone_number')}>Phone {sortArrow(txSort, 'phone_number')}</button></th>
                  <th><button className={`pay-sort-head ${txSort.key === 'amount' ? 'active' : ''}`} onClick={() => toggleSort(txSort, setTxSort, 'amount')}>Amount {sortArrow(txSort, 'amount')}</button></th>
                  <th><button className={`pay-sort-head ${txSort.key === 'status' ? 'active' : ''}`} onClick={() => toggleSort(txSort, setTxSort, 'status')}>Status {sortArrow(txSort, 'status')}</button></th>
                  <th><button className={`pay-sort-head ${txSort.key === 'yo_transaction_id' ? 'active' : ''}`} onClick={() => toggleSort(txSort, setTxSort, 'yo_transaction_id')}>YO! Ref {sortArrow(txSort, 'yo_transaction_id')}</button></th>
                  <th><button className={`pay-sort-head ${txSort.key === 'created_at' ? 'active' : ''}`} onClick={() => toggleSort(txSort, setTxSort, 'created_at')}>Date {sortArrow(txSort, 'created_at')}</button></th>
                </tr>
              </thead>
              <tbody>
                {txRows.length === 0 && (
                  <tr><td colSpan={6} className="pay-empty-row">No transactions match your filters.</td></tr>
                )}
                {txRows.map(tx => {
                  const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <tr key={tx.id}>
                      <td className="ref-cell"><code>{tx.internal_reference}</code></td>
                      <td>{tx.phone_number}</td>
                      <td className="amount-cell">{fmt(tx.amount)}</td>
                      <td><span className={`status-tag ${cfg.cls}`}><Icon size={12} /> {cfg.label}</span></td>
                      <td className="ref-cell">{tx.yo_transaction_id ? <code>{tx.yo_transaction_id}</code> : <span className="na">—</span>}</td>
                      <td>{fmtDate(tx.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPager(txPage, txTotalPages, setTxPage, sortedTransactions.length, txStart)}
          </div>
        )
      )}

      {/* Disbursements Table */}
      {tab === 'disbursements' && (
        loading ? (
          <div className="pay-loading"><Loader2 size={24} className="spin" /> Loading disbursements...</div>
        ) : disbursements.length === 0 ? (
          <div className="pay-empty glass">
            <ArrowUpCircle size={40} opacity={0.3} />
            <h3>No Disbursements Yet</h3>
            <p>When the admin disburses your earnings via mobile money, they will appear here.</p>
          </div>
        ) : (
          <div className="pay-table-wrapper glass">
            <div className="pay-table-tools">
              <div className="pay-search-wrap">
                <Search size={16} />
                <input
                  className="pay-search-input"
                  type="search"
                  placeholder="Search reference, phone, provider, status..."
                  value={disSearch}
                  onChange={(e) => setDisSearch(e.target.value)}
                />
              </div>
              <div className="pay-tools-right">
                <select className="pay-filter-select" value={disStatus} onChange={(e) => setDisStatus(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button className="pay-export-btn" onClick={exportDisbursementsCsv}>
                  <Download size={15} /> Export CSV
                </button>
              </div>
            </div>
            <table className="pay-table">
              <thead>
                <tr>
                  <th><button className={`pay-sort-head ${disSort.key === 'internal_reference' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'internal_reference')}>Reference {sortArrow(disSort, 'internal_reference')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'gross_amount' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'gross_amount')}>Gross Amount {sortArrow(disSort, 'gross_amount')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'platform_fee' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'platform_fee')}>Platform Fee ({platformFeeLabel}) {sortArrow(disSort, 'platform_fee')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'net_amount' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'net_amount')}>Net Paid To You {sortArrow(disSort, 'net_amount')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'phone_number' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'phone_number')}>Phone {sortArrow(disSort, 'phone_number')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'provider' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'provider')}>Provider {sortArrow(disSort, 'provider')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'status' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'status')}>Status {sortArrow(disSort, 'status')}</button></th>
                  <th><button className={`pay-sort-head ${disSort.key === 'created_at' ? 'active' : ''}`} onClick={() => toggleSort(disSort, setDisSort, 'created_at')}>Date {sortArrow(disSort, 'created_at')}</button></th>
                </tr>
              </thead>
              <tbody>
                {disRows.length === 0 && (
                  <tr><td colSpan={8} className="pay-empty-row">No disbursements match your filters.</td></tr>
                )}
                {disRows.map(d => {
                  const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <tr key={d.id}>
                      <td className="ref-cell"><code>{d.internal_reference}</code></td>
                      <td>{fmt(d.gross_amount)}</td>
                      <td className="fee-cell">-{fmt(d.platform_fee)}</td>
                      <td className="net-cell">{fmt(d.net_amount)}</td>
                      <td>{d.phone_number}</td>
                      <td><span className="provider-badge-sm">{d.provider}</span></td>
                      <td><span className={`status-tag ${cfg.cls}`}><Icon size={12} /> {cfg.label}</span></td>
                      <td>{fmtDate(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPager(disPage, disTotalPages, setDisPage, sortedDisbursements.length, disStart)}
          </div>
        )
      )}
    </div>
  );
};

export default Payments;
