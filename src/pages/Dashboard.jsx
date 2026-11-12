import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Package, ShoppingCart, BarChart3, Settings, LogOut,
  AlertCircle, FileCheck, CreditCard, Layers, Bell, Tag, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/queries';
import './Dashboard.css';

const Dashboard = () => {
  const { business, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifications = [] } = useNotifications({ refetchInterval: 30_000 });
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  if (loading) return <div className="loader">Loading Portal...</div>;

  if (!business) {
    return <Navigate to="/login" replace />;
  }

  const isApproved = business.status === 'APPROVED';
  const businessInitial = business.name ? business.name.charAt(0).toUpperCase() : 'B';

  const navClass = (match) =>
    `nav-item ${location.pathname === match || (match !== '/dashboard' && location.pathname.includes(match.replace('/dashboard/', ''))) ? 'active' : ''}`;

  return (
    <div className={`dashboard-layout ${navOpen ? 'nav-open' : ''}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close menu"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <aside className="sidebar" aria-hidden={false}>
        <div className="sidebar-brand-pod">
          <div className="business-logo-wrap">
            {business.logo_b64 ? (
              <img src={business.logo_b64} alt={business.name} className="business-sidebar-icon" />
            ) : (
              <div className="business-initial-logo">{businessInitial}</div>
            )}
          </div>
          <div className="brand-text-simple">
            POCHI <span>Business</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-sections">
          <div className="sidebar-group">
            <label className="group-label">Core</label>
            <Link to="/dashboard" className={navClass('/dashboard')}>
              <BarChart3 size={20} />
              <span className="nav-label">Dashboard</span>
            </Link>
            <Link
              to="/dashboard/notifications"
              className={`nav-item ${location.pathname.includes('notifications') ? 'active' : ''}`}
            >
              <Bell size={20} />
              <span className="nav-label">Notifications</span>
              {unreadCount > 0 && (
                <span className="sidebar-unread-badge pulsing-badge">{unreadCount}</span>
              )}
            </Link>
          </div>

          <div className="sidebar-group">
            <label className="group-label">Sales & Products</label>
            <Link
              to="/dashboard/products"
              className={`nav-item ${location.pathname.includes('products') ? 'active' : ''}`}
            >
              <Package size={20} />
              <span className="nav-label">My Products</span>
            </Link>
            <Link
              to="/dashboard/categories"
              className={`nav-item ${location.pathname.includes('categories') ? 'active' : ''}`}
            >
              <Layers size={20} />
              <span className="nav-label">Categories</span>
            </Link>
            <Link
              to="/dashboard/orders"
              className={`nav-item ${location.pathname.includes('orders') ? 'active' : ''}`}
            >
              <ShoppingCart size={20} />
              <span className="nav-label">Orders</span>
            </Link>
            <Link
              to="/dashboard/payments"
              className={`nav-item ${location.pathname.includes('payments') ? 'active' : ''}`}
            >
              <CreditCard size={20} />
              <span className="nav-label">Payments</span>
            </Link>
            <Link
              to="/dashboard/promotions"
              className={`nav-item ${location.pathname.includes('promotions') ? 'active' : ''}`}
            >
              <Tag size={20} />
              <span className="nav-label">Promotions</span>
            </Link>
          </div>

          <div className="sidebar-group bottom-group">
            <label className="group-label">Account & Trust</label>
            <Link
              to="/dashboard/kyc"
              className={`nav-item ${location.pathname.includes('kyc') ? 'active' : ''} ${!isApproved ? 'highlight' : ''}`}
            >
              <FileCheck size={20} />
              <span className="nav-label">Verification</span>
            </Link>
            <Link
              to="/dashboard/settings"
              className={`nav-item ${location.pathname.includes('settings') ? 'active' : ''}`}
            >
              <Settings size={20} />
              <span className="nav-label">Business Settings</span>
            </Link>
          </div>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut size={20} />
          <span className="nav-label">Logout</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={22} />
            </button>
            {!isApproved && (
              <div className="alert-banner warning animate-fade">
                <AlertCircle size={18} />
                <span className="alert-banner-full">
                  Account Not Verified - Your products are hidden from the marketplace.
                </span>
                <span className="alert-banner-short">Not verified — products hidden</span>
              </div>
            )}
          </div>
          <div className="user-info">
            <strong className="user-biz-name">{business.name}</strong>
            <span className={`status-tag ${business.status.toLowerCase()}`}>
              {business.status.replace('_', ' ')}
            </span>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
