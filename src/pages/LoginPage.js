// ============================================================
// src/pages/LoginPage.js
// ─────────────────────────────────────────────────────────────
// Magic link login screen.
// User enters email → Supabase sends a one-time link →
// clicking the link lands them back here → App.js detects
// the session and redirects to HuddlePage.
// ============================================================

import React, { useState } from 'react';
import { sendMagicLink } from '../lib/supabaseClient';
import HuddleLogo from '../assets/Huddle_Logo_Subject.png';

// ─────────────────────────────────────────
// States the form can be in
// ─────────────────────────────────────────
const STATES = {
  IDLE:    'idle',      // default, show the form
  LOADING: 'loading',  // waiting for Supabase response
  SENT:    'sent',     // email sent successfully
  ERROR:   'error',    // something went wrong
};

export default function LoginPage() {
  const [email,  setEmail]  = useState('');
  const [status, setStatus] = useState(STATES.IDLE);
  const [errMsg, setErrMsg] = useState('');

  // ─────────────────────────────────────────
  // Handle form submit
  // ─────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus(STATES.LOADING);
    setErrMsg('');

    const { error } = await sendMagicLink(email.trim());

    if (error) {
      setStatus(STATES.ERROR);
      setErrMsg(error.message || 'Something went wrong. Please try again.');
    } else {
      setStatus(STATES.SENT);
    }
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="login-page">
      {/* Background texture overlay */}
      <div className="login-bg-overlay" />

      <div className="login-card">

        {/* Logo + Brand */}
        <div className="login-brand">
          <img
            src={HuddleLogo}
            alt="Huddle"
            className="login-logo-img"
          />
          <h1 className="login-title">Huddle</h1>
          <p className="login-tagline">
            A simple way to stay close,<br />even on ordinary days.
          </p>
        </div>

        {/* Form area — switches based on status */}
        {status === STATES.SENT ? (
          // ── Success state ──
          <div className="login-sent">
            <div className="login-sent-icon">✉️</div>
            <h2>Check your email</h2>
            <p>
              We sent a magic link to<br />
              <strong>{email}</strong>
            </p>
            <p className="login-sent-sub">
              Click the link in the email to sign in.<br />
              You can close this tab.
            </p>
            <button
              className="login-resend-btn"
              onClick={() => setStatus(STATES.IDLE)}
            >
              Use a different email
            </button>
          </div>
        ) : (
          // ── Email entry form ──
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email" className="login-label">
              Your email address
            </label>

            <input
              id="email"
              type="email"
              className="login-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === STATES.LOADING}
              autoFocus
              required
            />

            {/* Error message */}
            {status === STATES.ERROR && (
              <p className="login-error">{errMsg}</p>
            )}

            <button
              type="submit"
              className="login-btn"
              disabled={status === STATES.LOADING || !email.trim()}
            >
              {status === STATES.LOADING ? (
                <span className="login-btn-loading">Sending…</span>
              ) : (
                'Send magic link'
              )}
            </button>

            <p className="login-fine-print">
              No password needed. We'll email you a one-time sign-in link.
            </p>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="login-footer">
        Stay connected through the real stuff.
      </p>
    </div>
  );
}