// ============================================================
// src/pages/LoginPage.js
// ─────────────────────────────────────────────────────────────
// Two-step OTP login:
//   Step 1 — user enters email → we send a 6-digit code
//   Step 2 — user enters code → verified in-app, no redirect
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { sendOtpCode, verifyOtpCode } from '../lib/supabaseClient';
import HuddleLogo from '../assets/Huddle_Logo_Subject.png';

const STEPS = {
  EMAIL: 'email',
  CODE:  'code',
};

export default function LoginPage() {
  const [step,      setStep]      = useState(STEPS.EMAIL);
  const [email,     setEmail]     = useState('');
  const [code,      setCode]      = useState(['', '', '', '', '', '']);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [resending, setResending] = useState(false);
  const [resent,    setResent]    = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === STEPS.CODE) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  async function handleSendCode(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await sendOtpCode(email.trim().toLowerCase());
    if (error) {
      setError(error.message || 'Could not send code. Please try again.');
      setLoading(false);
      return;
    }
    setLoading(false);
    setStep(STEPS.CODE);
  }

  async function handleVerifyCode(e) {
    e?.preventDefault();
    const token = code.join('');
    if (token.length < 6) return;
    setLoading(true);
    setError('');
    const { error } = await verifyOtpCode(email.trim().toLowerCase(), token);
    if (error) {
      setError('Incorrect code. Please try again.');
      setCode(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
    setLoading(false);
  }

  function handleCodeInput(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (digit && index === 5 && newCode.every(d => d)) {
      setTimeout(() => handleVerifyCode(), 100);
    }
  }

  function handleCodeKeyDown(index, e) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    await sendOtpCode(email.trim().toLowerCase());
    setCode(['', '', '', '', '', '']);
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 3000);
    inputRefs.current[0]?.focus();
  }

  return (
    <div className="login-page">
      <div className="login-bg-overlay" />
      <div className="login-card">
        <div className="login-brand">
          <img src={HuddleLogo} alt="Huddle" className="login-logo-img" />
          <h1 className="login-title">Huddle</h1>
          <p className="login-tagline">A simple way to stay close,<br />even on ordinary days.</p>
        </div>

        {step === STEPS.EMAIL ? (
          <form className="login-form" onSubmit={handleSendCode}>
            <label htmlFor="email" className="login-label">Your email address</label>
            <input
              id="email" type="email" className="login-input"
              placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading} autoFocus required
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="login-fine-print">We'll email you a 6-digit code. No password needed.</p>
          </form>

        ) : (
          <div className="login-otp-section">
            <p className="login-otp-prompt">
              Enter the 6-digit code sent to<br /><strong>{email}</strong>
            </p>
            <div className="login-otp-boxes">
              {code.map((digit, i) => (
                <input
                  key={i} ref={el => inputRefs.current[i] = el}
                  type="text" inputMode="numeric" maxLength={1}
                  className={`login-otp-box ${error ? 'error' : ''}`}
                  value={digit}
                  onChange={e => handleCodeInput(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  disabled={loading}
                />
              ))}
            </div>
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" onClick={handleVerifyCode}
              disabled={loading || code.join('').length < 6}>
              {loading ? 'Verifying…' : 'Verify code'}
            </button>
            <div className="login-otp-footer">
              <button className="login-resend-btn" onClick={handleResend} disabled={resending}>
                {resent ? '✓ Code resent' : resending ? 'Resending…' : 'Resend code'}
              </button>
              <span className="login-otp-divider">·</span>
              <button className="login-resend-btn"
                onClick={() => { setStep(STEPS.EMAIL); setError(''); setCode(['','','','','','']); }}>
                Change email
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="login-footer">Stay connected through the real stuff.</p>
    </div>
  );
}