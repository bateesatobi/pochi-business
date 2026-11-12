import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { alertSuccess, alertError, alertWarning } from '../utils/swal';
import { Mail, Lock, KeyRound, ArrowRight, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import './LoginPage.css';
import logo from '../assets/logo.png';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const requestCode = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      alertWarning('Email required', 'Enter the email you use to sign in to the business portal.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/auth/forgot-pin`, { email: trimmed });
      alertSuccess(
        'Check your email',
        data?.message || 'If this email is registered, a reset code has been sent.',
        { timer: 2800 }
      );
      setEmail(trimmed);
      setStep(2);
    } catch (err) {
      alertError(
        'Could not send reset code',
        err.response?.data?.detail || err.message || 'Please try again in a moment.'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < 4) {
      alertWarning('Code required', 'Enter the 6-digit code from your email.');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      alertWarning('Password too short', 'Use at least 4 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alertWarning('Passwords do not match', 'Re-enter the same password in both fields.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/auth/reset-pin`, {
        email: email.trim().toLowerCase(),
        code: trimmedCode,
        new_pin: newPassword,
      });
      alertSuccess(
        'Password updated',
        data?.message || 'You can now sign in with your new password.',
        { timer: 2200 }
      );
      setTimeout(() => navigate('/login', { replace: true }), 900);
    } catch (err) {
      alertError(
        'Reset failed',
        err.response?.data?.detail || 'Invalid email or reset code. Request a new code if this one expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/forgot-pin`, { email: email.trim().toLowerCase() });
      alertSuccess('Code resent', 'A new reset code was sent to your email.', { timer: 2200 });
    } catch (err) {
      alertError('Could not resend', err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="visual-content">
          <h1>Reset access to your <span>merchant account</span></h1>
          <p>
            We will email a one-time code so you can set a new password and get back to managing
            orders and payouts.
          </p>
          <div className="visual-stats">
            <div className="stat-item">
              <h3><ShieldCheck size={28} /></h3>
              <span>Secure email code</span>
            </div>
            <div className="stat-item">
              <h3>2</h3>
              <span>Quick steps</span>
            </div>
          </div>
        </div>
        <div className="visual-overlay" />
      </div>

      <div className="auth-form-container">
        <div className="auth-card animate-slide-up">
          <div className="auth-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div
                style={{
                  background: '#0b182a',
                  padding: '14px 20px',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                }}
              >
                <img src={logo} alt="Pochi" style={{ height: 40, width: 'auto' }} />
              </div>
            </div>
            <div
              className="brand-logo"
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#4f46e5',
                marginBottom: 32,
                textAlign: 'center',
              }}
            >
              Pochi Commerce
            </div>
            <h2>{step === 1 ? 'Forgot password' : 'Set new password'}</h2>
            <p>
              {step === 1
                ? 'Enter your business login email and we will send a reset code.'
                : `Enter the code sent to ${email}, then choose a new password.`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={requestCode} className="auth-form">
              <div className="form-input-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    placeholder="business@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Sending code...
                  </>
                ) : (
                  <>
                    Send reset code <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="auth-form">
              <div className="form-input-group">
                <label>Reset code</label>
                <div className="input-wrapper">
                  <KeyRound className="input-icon" size={18} />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                    autoComplete="one-time-code"
                    required
                  />
                </div>
              </div>

              <div className="form-input-group">
                <label>New password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={4}
                  />
                </div>
              </div>

              <div className="form-input-group">
                <label>Confirm password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={4}
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Updating...
                  </>
                ) : (
                  <>
                    Update password <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="auth-footer" style={{ marginTop: 8 }}>
                <p>
                  Didn’t get a code?{' '}
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4f46e5',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    Resend code
                  </button>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4f46e5',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    Change email
                  </button>
                </p>
              </div>
            </form>
          )}

          <div className="auth-footer">
            <p>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={16} /> Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
