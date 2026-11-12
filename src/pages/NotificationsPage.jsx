import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Bell, Check, Loader2, ShoppingBag, CheckSquare, ShieldCheck, Edit3, Info, X, ArrowRight, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';
import { useNotifications } from '../hooks/queries';
import { queryKeys } from '../lib/queryKeys';
import { alertSuccess } from '../utils/swal';
import './NotificationsPage.css';

const PAGE_SIZE = 8;
const NOTIF_VIEWS_KEY = 'business_notifications_saved_views_v1';
const DEFAULT_NOTIF_VIEW_FILTERS = {
  filter: 'all',
  searchTerm: '',
  sortBy: 'newest',
  dateScope: 'all',
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: notifications = [], isFetching } = useNotifications();
  
  const [filter, setFilter] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateScope, setDateScope] = useState('all');
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState('default');
  const [viewsHydrated, setViewsHydrated] = useState(false);

  const presetViews = [
    {
      id: 'unread_only',
      name: 'Unread Only',
      filters: { filter: 'unread', searchTerm: '', sortBy: 'newest', dateScope: 'all' },
    },
    {
      id: 'today_alerts',
      name: "Today's Alerts",
      filters: { filter: 'all', searchTerm: '', sortBy: 'newest', dateScope: 'today' },
    },
    {
      id: 'priority_queue',
      name: 'Unread First',
      filters: { filter: 'all', searchTerm: '', sortBy: 'unread_first', dateScope: 'last7' },
    },
  ];

  const persistUiState = async ({
    nextSavedViews = savedViews,
    nextActiveViewId = activeViewId,
    nextFilters = { filter, searchTerm, sortBy, dateScope },
  } = {}) => {
    const payload = {
      savedViews: nextSavedViews,
      activeViewId: nextActiveViewId,
      filters: nextFilters,
    };
    window.localStorage.setItem(NOTIF_VIEWS_KEY, JSON.stringify(payload));
    try {
      await api.put('/business/ui-state/notifications', { state: payload });
    } catch {
      // Keep local fallback if API sync is temporarily unavailable.
    }
  };

  const applyViewFilters = (filters, viewId = 'default') => {
    const merged = { ...DEFAULT_NOTIF_VIEW_FILTERS, ...(filters || {}) };
    setFilter(merged.filter);
    setSearchTerm(merged.searchTerm);
    setSortBy(merged.sortBy);
    setDateScope(merged.dateScope);
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
      filters: { filter, searchTerm, sortBy, dateScope },
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

  const updateNotifications = (updater) => {
    queryClient.setQueryData(queryKeys.notifications, (current = []) => updater(current));
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      updateNotifications((items) =>
        items.map((notif) => (notif.id === id ? { ...notif, is_read: true } : notif))
      );
      if (selectedNotification?.id === id) {
        setSelectedNotification((prev) => ({ ...prev, is_read: true }));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      updateNotifications((items) => items.map((notif) => ({ ...notif, is_read: true })));
      alertSuccess('All Cleared', 'All your notifications have been marked as read.');
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleCardClick = (notif) => {
    setSelectedNotification(notif);
    setDrawerOpen(true);
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ORDER_NEW':
        return <ShoppingBag className="icon-order-new" size={20} />;
      case 'ORDER_STATUS':
        return <CheckSquare className="icon-order-status" size={20} />;
      case 'KYC_STATUS':
        return <ShieldCheck className="icon-kyc-status" size={20} />;
      case 'PROFILE_CHANGE':
        return <Edit3 className="icon-profile-change" size={20} />;
      default:
        return <Info className="icon-default" size={20} />;
    }
  };

  const getNotificationColorClass = (type) => {
    switch (type) {
      case 'ORDER_NEW': return 'card-order-new';
      case 'ORDER_STATUS': return 'card-order-status';
      case 'KYC_STATUS': return 'card-kyc-status';
      case 'PROFILE_CHANGE': return 'card-profile-change';
      default: return 'card-default';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    const createdAt = new Date(notif.created_at);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const matchesDate =
      dateScope === 'today'
        ? createdAt >= startOfToday
        : dateScope === 'last7'
          ? createdAt >= sevenDaysAgo
          : true;
    const q = searchTerm.trim().toLowerCase();
    const matchesReadState =
      filter === 'unread' ? !notif.is_read : filter === 'read' ? notif.is_read : true;
    const matchesSearch =
      !q || [notif.title, notif.message, notif.type].join(' ').toLowerCase().includes(q);
    return matchesReadState && matchesSearch && matchesDate;
  });

  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === 'unread_first') {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const indexOfLast = currentPage * PAGE_SIZE;
  const indexOfFirst = indexOfLast - PAGE_SIZE;
  const pagedNotifications = sortedNotifications.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.max(1, Math.ceil(sortedNotifications.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const hydrate = async () => {
      let localState = null;
      try {
        const raw = window.localStorage.getItem(NOTIF_VIEWS_KEY);
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
        const res = await api.get('/business/ui-state/notifications');
        const serverState = res?.data?.state || {};
        if (Array.isArray(serverState.savedViews)) setSavedViews(serverState.savedViews);
        if (serverState.activeViewId) setActiveViewId(serverState.activeViewId);
        if (serverState.filters) applyViewFilters(serverState.filters, serverState.activeViewId || 'default');
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
  }, [viewsHydrated, savedViews, activeViewId, filter, searchTerm, sortBy, dateScope]);

  const unreadCount = notifications.filter(notif => !notif.is_read).length;

  return (
    <div className="notifications-portal-container animate-fade">
      <div className="portal-header">
        <div className="title-section">
          <h1>Corporate Notifications</h1>
          <p>Stay up to date with real-time merchant alerts, order events, and system compliance logs.</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-mark-all-read" onClick={handleMarkAllAsRead}>
            <Check size={16} /> Mark All as Read
          </button>
        )}
      </div>

      <div className="portal-sub-bar glass">
        <div className="filter-buttons">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`} 
            onClick={() => { setFilter('all'); setCurrentPage(1); }}
          >
            All Alerts ({notifications.length})
          </button>
          <button 
            className={`filter-tab ${filter === 'unread' ? 'active' : ''}`} 
            onClick={() => { setFilter('unread'); setCurrentPage(1); }}
          >
            Unread ({unreadCount})
          </button>
          <button 
            className={`filter-tab ${filter === 'read' ? 'active' : ''}`} 
            onClick={() => { setFilter('read'); setCurrentPage(1); }}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>
        
        <div className="revalidate-spinner-wrapper">
          {isFetching && <Loader2 size={16} className="animate-spin text-muted" />}
        </div>
      </div>

      <div className="notif-tools glass">
        <div className="notif-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search title, message, or type..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <select className="notif-sort" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="unread_first">Unread first</option>
        </select>
        <select className="notif-sort" value={dateScope} onChange={(e) => { setDateScope(e.target.value); setCurrentPage(1); }}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="last7">Last 7 days</option>
        </select>
      </div>

      <div className="notif-saved-views">
        <button
          className={`notif-view-chip ${activeViewId === 'default' ? 'active' : ''}`}
          onClick={() => applyViewFilters({ filter: 'all', searchTerm: '', sortBy: 'newest', dateScope: 'all' }, 'default')}
        >
          Default
        </button>
        {presetViews.map((view) => (
          <button
            key={view.id}
            className={`notif-view-chip ${activeViewId === view.id ? 'active' : ''}`}
            onClick={() => applyViewFilters(view.filters, view.id)}
          >
            {view.name}
          </button>
        ))}
        {savedViews.map((view) => (
          <div key={view.id} className={`notif-view-chip custom ${activeViewId === view.id ? 'active' : ''}`}>
            <button onClick={() => applyViewFilters(view.filters, view.id)}>{view.name}</button>
            <button className="notif-view-remove" onClick={() => removeSavedView(view.id)}>×</button>
          </div>
        ))}
        <button className="notif-save-view-btn" onClick={saveCurrentView}>Save current view</button>
      </div>

      <div className="notifications-list">
        {sortedNotifications.length === 0 ? (
          <div className="empty-notifications glass animate-fade">
            <Bell size={48} className="empty-bell-icon" />
            <h3>No Notifications Found</h3>
            <p>You are all caught up! When new orders are received or profile updates take place, they will display instantly here.</p>
          </div>
        ) : (
          pagedNotifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`notification-card glass ${getNotificationColorClass(notif.type)} ${notif.is_read ? 'read-card' : 'unread-card'} animate-fade`}
              onClick={() => handleCardClick(notif)}
            >
              <div className="card-left">
                <div className="icon-container-wrapper">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="notification-details">
                  <div className="details-header">
                    <h4>{notif.title}</h4>
                    <span className="notif-time">
                      {new Date(notif.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p>{notif.message}</p>
                </div>
              </div>

              <div className="card-right">
                {!notif.is_read ? (
                  <>
                    <span className="unread-pulse-dot"></span>
                    <button 
                      className="btn-action-read" 
                      title="Mark as Read" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                    >
                      <Check size={16} />
                    </button>
                  </>
                ) : (
                  <span className="read-checkmark-icon" title="Read Alert"><Check size={16} /></span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {sortedNotifications.length > PAGE_SIZE && (
        <div className="notif-pagination">
          <div className="notif-page-info">
            Showing {indexOfFirst + 1}-{Math.min(indexOfLast, sortedNotifications.length)} of {sortedNotifications.length}
          </div>
          <div className="notif-page-btns">
            <button className="notif-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                className={`notif-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button className="notif-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Slide-out Detail Drawer */}
      {selectedNotification && (
        <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => { setDrawerOpen(false); setTimeout(() => setSelectedNotification(null), 300); }}>
          <div className={`detail-drawer glass ${drawerOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Notification Details</h3>
              <button className="btn-close-drawer" onClick={() => { setDrawerOpen(false); setTimeout(() => setSelectedNotification(null), 300); }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="drawer-body">
              <div className={`drawer-icon-hero ${getNotificationColorClass(selectedNotification.type)}`}>
                {getNotificationIcon(selectedNotification.type)}
              </div>
              
              <h2 className="drawer-title">{selectedNotification.title}</h2>
              
              <div className="drawer-meta">
                <span className={`status-badge-tag ${selectedNotification.is_read ? 'read' : 'unread'}`}>
                  {selectedNotification.is_read ? 'Read' : 'Unread'}
                </span>
                <span className="drawer-time">
                  {new Date(selectedNotification.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              
              <div className="drawer-divider"></div>
              
              <p className="drawer-message">{selectedNotification.message}</p>
              
              <div className="drawer-actions-block">
                {selectedNotification.type === 'ORDER_NEW' || selectedNotification.type === 'ORDER_STATUS' ? (
                  <button className="btn-drawer-action" onClick={() => { setDrawerOpen(false); setTimeout(() => navigate('/dashboard/orders'), 300); }}>
                    View Merchant Orders <ArrowRight size={16} />
                  </button>
                ) : selectedNotification.type === 'KYC_STATUS' ? (
                  <button className="btn-drawer-action" onClick={() => { setDrawerOpen(false); setTimeout(() => navigate('/dashboard/kyc'), 300); }}>
                    View Compliance Verification <ArrowRight size={16} />
                  </button>
                ) : selectedNotification.type === 'PROFILE_CHANGE' ? (
                  <button className="btn-drawer-action" onClick={() => { setDrawerOpen(false); setTimeout(() => navigate('/dashboard/settings'), 300); }}>
                    View Business Settings <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
