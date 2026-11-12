import React, { useEffect, useState } from 'react';
import {
  useOrders,
  useUpdateOrderStatus,
  useUpdateOrderTracking,
} from '../hooks/queries';
import { api } from '../lib/api';
import {
  ShoppingCart, Clock, CheckCircle, Truck, AlertCircle,
  ChevronRight, X, User, Calendar, Package, Eye, AlertTriangle,
  TrendingUp, Search, ChevronLeft, Info, Link2, Download,
} from 'lucide-react';
import { toast, alertError } from '../utils/swal';
import { formatMoney, roundForCurrency } from '../utils/currency';
import './Orders.css';

const ORDERS_VIEWS_KEY = 'business_orders_saved_views_v1';
const DEFAULT_ORDER_VIEW_FILTERS = {
  searchTerm: '',
  startDate: '',
  endDate: '',
  statusFilter: 'ALL',
  sortBy: 'date_desc',
};
const shortId = (id) => (id ? String(id).slice(0, 8) : '—');
const orderAmount = (order) => order?.subtotal ?? order?.total ?? 0;
const hasParentRef = (order) =>
  order?.parent_order_id && String(order.parent_order_id) !== String(order.id);
const money = (amount, order) => formatMoney(amount, order?.currency || 'UGX');
const amountNumber = (amount, order) =>
  roundForCurrency(amount, order?.currency || 'UGX').toLocaleString();

const Orders = () => {
  const { data: orders = [], refetch } = useOrders();
  const updateTracking = useUpdateOrderTracking();
  const updateStatus = useUpdateOrderStatus();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingForm, setTrackingForm] = useState({
    tracking_number: '',
    carrier: '',
    estimated_delivery_at: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState('default');
  const [viewsHydrated, setViewsHydrated] = useState(false);

  const presetViews = [
    {
      id: 'pending_only',
      name: 'Pending Only',
      filters: { searchTerm: '', startDate: '', endDate: '', statusFilter: 'PENDING', sortBy: 'date_desc' },
    },
    {
      id: 'today_orders',
      name: "Today's Orders",
      filters: {
        searchTerm: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        statusFilter: 'ALL',
        sortBy: 'date_desc',
      },
    },
    {
      id: 'value_high',
      name: 'High Value First',
      filters: { searchTerm: '', startDate: '', endDate: '', statusFilter: 'ALL', sortBy: 'amount_desc' },
    },
  ];

  const persistUiState = async ({
    nextSavedViews = savedViews,
    nextActiveViewId = activeViewId,
    nextFilters = {
      searchTerm,
      startDate,
      endDate,
      statusFilter,
      sortBy,
    },
  } = {}) => {
    const payload = {
      savedViews: nextSavedViews,
      activeViewId: nextActiveViewId,
      filters: nextFilters,
    };
    window.localStorage.setItem(ORDERS_VIEWS_KEY, JSON.stringify(payload));
    try {
      await api.put('/business/ui-state/orders', { state: payload });
    } catch {
      // Keep local fallback if API sync is temporarily unavailable.
    }
  };

  const applyViewFilters = (filters, viewId = 'default') => {
    const merged = { ...DEFAULT_ORDER_VIEW_FILTERS, ...(filters || {}) };
    setSearchTerm(merged.searchTerm);
    setStartDate(merged.startDate);
    setEndDate(merged.endDate);
    setStatusFilter(merged.statusFilter);
    setSortBy(merged.sortBy);
    setCurrentPage(1);
    setActiveViewId(viewId);
    if (viewsHydrated) {
      persistUiState({ nextActiveViewId: viewId, nextFilters: merged });
    }
  };

  const saveCurrentView = () => {
    const name = window.prompt('Saved view name');
    if (!name?.trim()) return;
    const view = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      filters: { searchTerm, startDate, endDate, statusFilter, sortBy },
    };
    const nextSavedViews = [view, ...savedViews].slice(0, 8);
    setSavedViews(nextSavedViews);
    setActiveViewId(view.id);
    persistUiState({ nextSavedViews, nextActiveViewId: view.id });
  };

  const removeSavedView = (id) => {
    const nextSavedViews = savedViews.filter((view) => view.id !== id);
    const nextActiveViewId = activeViewId === id ? 'default' : activeViewId;
    setSavedViews(nextSavedViews);
    if (activeViewId === id) setActiveViewId('default');
    persistUiState({ nextSavedViews, nextActiveViewId });
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setTrackingForm({
      tracking_number: order.tracking_number || '',
      carrier: order.carrier || '',
      estimated_delivery_at: order.estimated_delivery_at
        ? String(order.estimated_delivery_at).slice(0, 10)
        : '',
    });
    setIsDrawerOpen(true);
  };

  useEffect(() => {
    if (!selectedOrder?.id || !orders.length) return;
    const fresh = orders.find((o) => String(o.id) === String(selectedOrder.id));
    if (fresh) setSelectedOrder(fresh);
  }, [orders, selectedOrder?.id]);

  useEffect(() => {
    const hydrate = async () => {
      let localState = null;
      try {
        const raw = window.localStorage.getItem(ORDERS_VIEWS_KEY);
        localState = raw ? JSON.parse(raw) : null;
      } catch {
        localState = null;
      }
      if (Array.isArray(localState)) {
        setSavedViews(localState);
      }
      if (localState?.savedViews) setSavedViews(localState.savedViews);
      if (localState?.activeViewId) setActiveViewId(localState.activeViewId);
      if (localState?.filters) applyViewFilters(localState.filters, localState.activeViewId || 'default');

      try {
        const res = await api.get('/business/ui-state/orders');
        const serverState = res?.data?.state || {};
        if (Array.isArray(serverState.savedViews)) setSavedViews(serverState.savedViews);
        if (serverState.activeViewId) setActiveViewId(serverState.activeViewId);
        if (serverState.filters) {
          applyViewFilters(serverState.filters, serverState.activeViewId || 'default');
        }
      } catch {
        // Stay on local fallback if server fetch fails.
      } finally {
        setViewsHydrated(true);
      }
    };
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!viewsHydrated) return;
    const timer = setTimeout(() => {
      persistUiState();
    }, 350);
    return () => clearTimeout(timer);
  }, [viewsHydrated, savedViews, activeViewId, searchTerm, startDate, endDate, statusFilter, sortBy]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return <Clock size={16} />;
      case 'PAID': return <CheckCircle size={16} />;
      case 'FULFILLED': return <Truck size={16} />;
      case 'DELIVERED': return <CheckCircle size={16} />;
      case 'CANCELLED': return <X size={16} />;
      case 'REFUNDED': return <AlertCircle size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.created_at);
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      String(order.id || '').toLowerCase().includes(q) ||
      String(order.user_id || '').toLowerCase().includes(q) ||
      String(order.parent_order_id || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    const matchesStart = startDate ? orderDate >= new Date(startDate) : true;
    const matchesEnd = endDate ? orderDate <= new Date(endDate + 'T23:59:59') : true;

    return matchesSearch && matchesStatus && matchesStart && matchesEnd;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === 'amount_asc') return orderAmount(a) - orderAmount(b);
    if (sortBy === 'amount_desc') return orderAmount(b) - orderAmount(a);
    if (sortBy === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = sortedOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const exportOrdersCsv = () => {
    const headers = ['sub_order_id', 'parent_order_id', 'customer_id', 'status', 'amount', 'currency', 'created_at'];
    const rows = sortedOrders.map((order) => ({
      sub_order_id: order.id,
      parent_order_id: order.parent_order_id,
      customer_id: order.user_id,
      status: order.status,
      amount: orderAmount(order),
      currency: order.currency || 'UGX',
      created_at: order.created_at,
    }));
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const value = row[h] ?? '';
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'business-orders.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalRevenue = filteredOrders
    .filter((o) => ['PAID', 'FULFILLED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + orderAmount(o), 0);

  const pendingOrdersCount = filteredOrders.filter((o) => o.status === 'PENDING').length;
  const cancelledOrdersCount = filteredOrders.filter((o) => o.status === 'CANCELLED').length;

  const handleSaveTracking = async () => {
    if (!selectedOrder?.id) return;
    try {
      const payload = {
        tracking_number: trackingForm.tracking_number.trim() || null,
        carrier: trackingForm.carrier.trim() || null,
        estimated_delivery_at: trackingForm.estimated_delivery_at
          ? new Date(trackingForm.estimated_delivery_at).toISOString()
          : null,
      };
      const data = await updateTracking.mutateAsync({ orderId: selectedOrder.id, payload });
      toast('Tracking saved', 'Shipment details updated for your sub-order.');
      setSelectedOrder((prev) => (prev ? {
        ...prev,
        tracking_number: data.tracking_number ?? payload.tracking_number,
        carrier: data.carrier ?? payload.carrier,
        estimated_delivery_at: data.estimated_delivery_at ?? payload.estimated_delivery_at,
      } : prev));
      refetch();
    } catch (err) {
      alertError('Could not save tracking', err.response?.data?.detail || 'Please try again.');
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!selectedOrder?.id) return;
    try {
      await updateStatus.mutateAsync({ orderId: selectedOrder.id, status });
      toast('Status updated', `Sub-order marked as ${status}.`);
      setSelectedOrder((prev) => (prev ? { ...prev, status } : prev));
      refetch();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Please try again.';
      if (String(detail).toLowerCase().includes('funding not yet received by pochi')) {
        alertError('Funding Not Received', 'This Pay Later order can only be fulfilled or delivered after funding is received by Pochi.');
      } else {
        alertError('Status update failed', detail);
      }
    }
  };

  const releaseBlocked = !!(selectedOrder?.is_pay_later && !selectedOrder?.funding_received);
  const canMarkFulfilled = selectedOrder?.status === 'PAID' && !releaseBlocked;
  const canMarkDelivered = selectedOrder?.status === 'FULFILLED' && !releaseBlocked;

  return (
    <div className="orders-container animate-fade">
      <div className="page-header-refined">
        <div className="title-group">
          <h1>Orders & Fulfillment</h1>
          <p>Managing {filteredOrders.length} vendor sub-order{filteredOrders.length === 1 ? '' : 's'}.</p>
        </div>
      </div>

      <div className="stats-grid-compact">
        <div className="stat-card-refined glass">
          <div className="icon emerald"><TrendingUp size={20} /></div>
          <div className="info">
            <span className="lbl">View Revenue</span>
            <span className="val">{formatMoney(totalRevenue, 'UGX')}</span>
          </div>
        </div>
        <div className="stat-card-refined glass">
          <div className="icon amber"><Clock size={20} /></div>
          <div className="info">
            <span className="lbl">Pending</span>
            <span className="val">{pendingOrdersCount}</span>
          </div>
        </div>
        <div className="stat-card-refined glass">
          <div className="icon rose"><AlertCircle size={20} /></div>
          <div className="info">
            <span className="lbl">Cancelled</span>
            <span className="val">{cancelledOrdersCount}</span>
          </div>
        </div>
      </div>

      <div className="inventory-controls glass">
        <div className="search-box-refined">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search sub-order, parent order, or customer..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="date-filter-group">
          <div className="date-input-wrapper">
            <Calendar size={16} />
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} />
          </div>
          <span className="date-separator">to</span>
          <div className="date-input-wrapper">
            <Calendar size={16} />
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} />
          </div>
          {(startDate || endDate || searchTerm) && (
            <button className="clear-filters-btn" onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); setStatusFilter('ALL'); }}>Reset</button>
          )}
          <select className="orders-select-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select className="orders-select-filter" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Amount high-low</option>
            <option value="amount_asc">Amount low-high</option>
          </select>
          <button className="orders-export-btn" onClick={exportOrdersCsv}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="orders-saved-views">
        <button
          className={`orders-view-chip ${activeViewId === 'default' ? 'active' : ''}`}
          onClick={() =>
            applyViewFilters(
              { searchTerm: '', startDate: '', endDate: '', statusFilter: 'ALL', sortBy: 'date_desc' },
              'default'
            )
          }
        >
          Default
        </button>
        {presetViews.map((view) => (
          <button
            key={view.id}
            className={`orders-view-chip ${activeViewId === view.id ? 'active' : ''}`}
            onClick={() => applyViewFilters(view.filters, view.id)}
          >
            {view.name}
          </button>
        ))}
        {savedViews.map((view) => (
          <div key={view.id} className={`orders-view-chip custom ${activeViewId === view.id ? 'active' : ''}`}>
            <button onClick={() => applyViewFilters(view.filters, view.id)}>{view.name}</button>
            <button className="orders-view-remove" onClick={() => removeSavedView(view.id)}>×</button>
          </div>
        ))}
        <button className="orders-save-view-btn" onClick={saveCurrentView}>Save current view</button>
      </div>

      <div className="orders-table-wrapper glass animate-fade">
        <table className="orders-table-refined">
          <thead>
            <tr>
              <th>Sub-Order</th>
              <th>Parent</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Your Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentOrders.length === 0 ? (
              <tr><td colSpan="7" className="empty-row">No records found.</td></tr>
            ) : (
              currentOrders.map((order) => (
                <tr key={order.id} onClick={() => openOrderDetails(order)} className="clickable-row">
                  <td><span className="order-id-txt">#{shortId(order.id)}</span></td>
                  <td>
                    <span className="order-id-txt muted-id">
                      {hasParentRef(order) ? `#${shortId(order.parent_order_id)}` : '—'}
                    </span>
                  </td>
                  <td>
                    <div className="customer-cell-content">
                      <div className="cust-avatar"><User size={14} /></div>
                      <span>{shortId(order.user_id)}</span>
                    </div>
                  </td>
                  <td><span className="date-txt">{order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</span></td>
                  <td>
                    <div className="amt-cell-content">
                      <span className="amt-val">{amountNumber(orderAmount(order), order)}</span>
                      <span className="amt-cur">{order.currency || 'UGX'}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`order-status-badge ${order.status?.toLowerCase()}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <button className="view-details-btn-mini" onClick={(e) => { e.stopPropagation(); openOrderDetails(order); }}>
                      <Eye size={16} /> Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination-bar">
            <div className="pagination-info">Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, sortedOrders.length)} of {sortedOrders.length}</div>
            <div className="pagination-btns">
              <button disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)} className="p-btn"><ChevronLeft size={18} /></button>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i + 1} onClick={() => paginate(i + 1)} className={`p-btn ${currentPage === i + 1 ? 'active' : ''}`}>{i + 1}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)} className="p-btn"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>

      <div className={`expert-drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={() => setIsDrawerOpen(false)}>
        <div className="expert-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-nav">
            <div className="nav-header">
              <div className="icon-badge"><ShoppingCart size={24} /></div>
              <div className="text">
                <h2>Sub-Order Details</h2>
                <p>#{shortId(selectedOrder?.id)}</p>
              </div>
            </div>
            <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}><X /></button>
          </div>

          <div className="drawer-main">
            {selectedOrder && (
              <div className="order-details-panel animate-fade">
                <div className="details-section glass">
                  <div className="section-title"><Info size={16} /> Summary</div>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Status</label>
                      <span className={`status-tag-big ${selectedOrder.status?.toLowerCase()}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Sub-Order ID</label>
                      <span className="val mono">{selectedOrder.id}</span>
                    </div>
                    {hasParentRef(selectedOrder) && (
                      <div className="info-item">
                        <label>Parent Order</label>
                        <span className="val mono"><Link2 size={12} /> {selectedOrder.parent_order_id}</span>
                      </div>
                    )}
                    <div className="info-item">
                      <label>Order Date</label>
                      <span className="val">{new Date(selectedOrder.created_at).toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <label>Customer ID</label>
                      <span className="val">{selectedOrder.user_id}</span>
                    </div>
                    <div className="info-item">
                      <label>Fulfillment</label>
                      <span className="val">{selectedOrder.pickup_from_store ? 'Store pickup' : 'Delivery'}</span>
                    </div>
                    <div className="info-item">
                      <label>Pay Later Funding</label>
                      {selectedOrder.is_pay_later ? (
                        <span className={`paylater-gate-chip ${selectedOrder.funding_received ? 'ok' : 'blocked'}`}>
                          {selectedOrder.funding_received ? 'Funding received' : 'Waiting for funding'}
                        </span>
                      ) : (
                        <span className="val">Not a Pay Later order</span>
                      )}
                    </div>
                    {selectedOrder.is_pay_later && !selectedOrder.funding_received && (
                      <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                        <label>Release block reason</label>
                        <span className="paylater-gate-reason">
                          <AlertTriangle size={13} />
                          {selectedOrder.release_block_reason || `Funding pending on ${selectedOrder.pending_loan_count || 0} financing request(s).`}
                        </span>
                      </div>
                    )}
                    {!selectedOrder.pickup_from_store ? (
                      <>
                    <div className="info-item">
                      <label>Receiver name</label>
                      <span className="val">{selectedOrder.receiver_name || '—'}</span>
                    </div>
                    <div className="info-item">
                      <label>Telephone</label>
                      <span className="val">{selectedOrder.receiver_phone || '—'}</span>
                    </div>
                    <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                      <label>Delivery address</label>
                      <span className="val">{selectedOrder.delivery_address || '—'}</span>
                    </div>
                      </>
                    ) : (selectedOrder.receiver_name || selectedOrder.receiver_phone) ? (
                      <>
                    <div className="info-item">
                      <label>Contact name</label>
                      <span className="val">{selectedOrder.receiver_name || '—'}</span>
                    </div>
                    <div className="info-item">
                      <label>Contact phone</label>
                      <span className="val">{selectedOrder.receiver_phone || '—'}</span>
                    </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="details-section glass">
                  <div className="section-title"><Package size={16} /> Your Items</div>
                  <div className="order-items-list">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="order-item-row">
                        <div className="item-main">
                          <div className="item-icon"><Package size={14} /></div>
                          <div className="item-text">
                            <strong>{item.product_name || item.sku}</strong>
                            <span>{item.sku} · Qty: {item.quantity}</span>
                          </div>
                        </div>
                        <div className="item-price">
                          {money(((item.unit_price * item.quantity) - (item.discount_applied || 0)), selectedOrder)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="order-total-footer">
                    <span>Your Subtotal</span>
                    <span className="total-val">{money(orderAmount(selectedOrder), selectedOrder)}</span>
                  </div>
                </div>

                <div className="details-section glass">
                  <div className="section-title"><Truck size={16} /> Shipment Tracking</div>
                  <div className="tracking-form-grid">
                    <label>
                      Tracking number
                      <input
                        type="text"
                        value={trackingForm.tracking_number}
                        onChange={(e) => setTrackingForm((f) => ({ ...f, tracking_number: e.target.value }))}
                        placeholder="e.g. TRK-12345"
                      />
                    </label>
                    <label>
                      Carrier
                      <input
                        type="text"
                        value={trackingForm.carrier}
                        onChange={(e) => setTrackingForm((f) => ({ ...f, carrier: e.target.value }))}
                        placeholder="e.g. DHL, Posta Uganda"
                      />
                    </label>
                    <label>
                      Estimated delivery
                      <input
                        type="date"
                        value={trackingForm.estimated_delivery_at}
                        onChange={(e) => setTrackingForm((f) => ({ ...f, estimated_delivery_at: e.target.value }))}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn-tracking-save"
                    disabled={updateTracking.isPending}
                    onClick={handleSaveTracking}
                  >
                    {updateTracking.isPending ? 'Saving...' : 'Save tracking'}
                  </button>
                </div>

                {(canMarkFulfilled || canMarkDelivered) && (
                  <div className="details-section glass">
                    <div className="section-title"><CheckCircle size={16} /> Fulfillment Actions</div>
                    <div className="fulfillment-actions">
                      {canMarkFulfilled && (
                        <button
                          type="button"
                          className="btn-status-action fulfilled"
                          disabled={updateStatus.isPending}
                          onClick={() => handleStatusUpdate('FULFILLED')}
                        >
                          Mark Fulfilled
                        </button>
                      )}
                      {canMarkDelivered && (
                        <button
                          type="button"
                          className="btn-status-action delivered"
                          disabled={updateStatus.isPending}
                          onClick={() => handleStatusUpdate('DELIVERED')}
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {selectedOrder?.is_pay_later && releaseBlocked && (
                  <div className="details-section glass paylater-gate-panel">
                    <div className="section-title"><AlertTriangle size={16} /> Fulfillment Blocked</div>
                    <p>You cannot mark this order as fulfilled or delivered until Pay Later funding is received by Pochi.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;
