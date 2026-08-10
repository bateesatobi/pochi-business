import React, { useEffect, useState } from 'react';
import {
  useOrders,
  useUpdateOrderStatus,
  useUpdateOrderTracking,
} from '../hooks/queries';
import {
  ShoppingCart, Clock, CheckCircle, Truck, AlertCircle,
  ChevronRight, X, User, Calendar, Package, Eye,
  TrendingUp, Search, ChevronLeft, Info, Link2,
} from 'lucide-react';
import { toast, alertError } from '../utils/swal';
import { formatMoney, roundForCurrency } from '../utils/currency';
import './Orders.css';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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

    const matchesStart = startDate ? orderDate >= new Date(startDate) : true;
    const matchesEnd = endDate ? orderDate <= new Date(endDate + 'T23:59:59') : true;

    return matchesSearch && matchesStart && matchesEnd;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
      alertError('Status update failed', err.response?.data?.detail || 'Please try again.');
    }
  };

  const canMarkFulfilled = selectedOrder?.status === 'PAID';
  const canMarkDelivered = selectedOrder?.status === 'FULFILLED';

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
            <button className="clear-filters-btn" onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}>Reset</button>
          )}
        </div>
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
            <div className="pagination-info">Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredOrders.length)} of {filteredOrders.length}</div>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;
