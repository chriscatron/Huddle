// ============================================================
// src/pages/LoginPage.js
// ─────────────────────────────────────────────────────────────
// Handles three flows:
//   1. Returning user — email → OTP code → in
//   2. New user — invite code → huddle preview → name → email → OTP → in
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { supabase, sendOtpCode, verifyOtpCode } from '../lib/supabaseClient';
import HuddleLogo from '../assets/Huddle_Logo_Subject.png';

const STEPS = {
  INTRO:        'intro',
  LANDING:      'landing',
  WELCOME:      'welcome',
  INVITE_CODE:  'invite_code',
  INVITE_NAME:  'invite_name',
  INVITE_EMAIL: 'invite_email',
  CREATE_NAME:  'create_name',
  CREATE_EMAIL: 'create_email',
  EMAIL:        'email',
  CODE:         'code',
};

export default function LoginPage() {
  const [step,        setStep]        = useState(() => {
    return localStorage.getItem('huddle_visited') ? STEPS.LANDING : STEPS.INTRO;
  });
  const [isCreating,  setIsCreating]  = useState(false);
  const [inviteCode,  setInviteCode]  = useState('');
  const [huddle,      setHuddle]      = useState(null); // huddle found by code
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [otpCode,     setOtpCode]     = useState(['', '', '', '', '', '']);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [resent,      setResent]      = useState(false);
  const [pendingJoin, setPendingJoin] = useState(null); // { huddleId, name } to join after OTP

  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === STEPS.CODE) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // ── Validate invite code ────────────────
  async function handleInviteCode(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('huddles')
      .select('id, name')
      .eq('invite_token', inviteCode.trim().toUpperCase())
      .single();

    if (error || !data) {
      setError('Invalid invite code. Please check and try again.');
      setLoading(false);
      return;
    }

    setHuddle(data);
    setLoading(false);
    setStep(STEPS.INVITE_NAME);
  }

  // ── New user name ───────────────────────
  function handleNameSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(STEPS.INVITE_EMAIL);
  }

  // ── New user email → send OTP ───────────
  async function handleInviteEmail(e) {
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

    // Store join details to process after OTP verification
    setPendingJoin({ huddleId: huddle.id, name: name.trim() });
    setLoading(false);
    setStep(STEPS.CODE);
  }

  // ── Returning user email → send OTP ─────
  async function handleReturningEmail(e) {
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

  // ── Verify OTP ──────────────────────────
  async function handleVerifyCode(e) {
    e?.preventDefault();
    const token = otpCode.join('');
    if (token.length < 6) return;
    setLoading(true);
    setError('');

    const { data: authData, error } = await verifyOtpCode(email.trim().toLowerCase(), token);

    if (error) {
      setError('Incorrect code. Please try again.');
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      setLoading(false);
      return;
    }

    // If new user — set name and join huddle
    if (pendingJoin && authData?.user) {
      await supabase
        .from('profiles')
        .update({ username: pendingJoin.name })
        .eq('id', authData.user.id);

      await supabase
        .from('huddle_members')
        .insert({ huddle_id: pendingJoin.huddleId, user_id: authData.user.id })
        .select()
        .single();
    }

    // If creating — set name, is_founder, and flag to open create dialog
    if (isCreating && authData?.user) {
      await supabase
        .from('profiles')
        .update({ username: name.trim(), is_founder: true })
        .eq('id', authData.user.id);

      localStorage.setItem('huddle_open_create', 'true');
    }

    // App.js onAuthStateChange fires and routes to HuddlePage
    setLoading(false);
  }

  // ── OTP digit input ─────────────────────
  function handleOtpInput(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (digit && index === 5 && newCode.every(d => d)) {
      setTimeout(() => handleVerifyCode(), 100);
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    await sendOtpCode(email.trim().toLowerCase());
    setOtpCode(['', '', '', '', '', '']);
    setResent(true);
    setTimeout(() => setResent(false), 3000);
    inputRefs.current[0]?.focus();
  }

  function dismissIntro() {
    localStorage.setItem('huddle_visited', 'true');
    setStep(STEPS.LANDING);
  }

  function startCreate() {
    setIsCreating(true);
    setStep(STEPS.CREATE_NAME);
  }

  function startJoin() {
    setIsCreating(false);
    setStep(STEPS.WELCOME);
  }

  function handleCreateNameSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep(STEPS.CREATE_EMAIL);
  }

  async function handleCreateEmail(e) {
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

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-bg-overlay" />
      <div className="login-card">

        <div className="login-brand">
          <img src={HuddleLogo} alt="Huddle" className="login-logo-img" />
          <h1 className="login-title">Huddle</h1>
          <p className="login-tagline">A simple way to stay close,<br />even on ordinary days.</p>
        </div>

        {/* ── First Visit Intro ── */}
        {step === STEPS.INTRO && (
          <div className="login-intro">
            <h2 className="login-intro-title">Welcome to Huddle</h2>
            <p className="login-intro-body">
              Huddle is a private space for small groups — friends, family, a team — to stay genuinely connected.
            </p>
            <p className="login-intro-body">
              Your group picks a word. Each letter becomes a reflection theme. Members pop in, share a thought, and stay connected. No noise, no algorithm — just your people.
            </p>
            <div className="login-intro-steps">
              <div className="login-intro-step">
                <span className="login-intro-icon">✦</span>
                <span>Choose a word that means something to your group</span>
              </div>
              <div className="login-intro-step">
                <span className="login-intro-icon">✦</span>
                <span>Each letter becomes a reflection prompt for your group</span>
              </div>
              <div className="login-intro-step">
                <span className="login-intro-icon">✦</span>
                <span>Invite your people with a private code</span>
              </div>
              <div className="login-intro-step">
                <span className="login-intro-icon">✦</span>
                <span>Share, react, and stay close</span>
              </div>
            </div>
            <button className="login-btn" onClick={dismissIntro}>
              Let's go
            </button>
          </div>
        )}

        {/* ── Landing ── */}
        {step === STEPS.LANDING && (
          <div className="login-landing">
            <button className="login-btn" onClick={startCreate}>
              ✦ Create a Huddle
            </button>
            <button className="login-btn" onClick={startJoin}>
              Join a Huddle
            </button>
            <button className="login-btn-secondary" onClick={() => setStep(STEPS.EMAIL)}>
              Sign in
            </button>
          </div>
        )}

        {/* ── Welcome / PWA instructions ── */}
        {step === STEPS.WELCOME && (
          <div className="login-welcome">
            <h2 className="login-welcome-title">Before you dive in</h2>
            <p className="login-welcome-intro">For the best experience, add Huddle to your home screen:</p>
            <ol className="login-welcome-steps">
              <li>
                <span className="login-welcome-num">1</span>
                <span>Make sure you're in <strong>Safari</strong> on your iPhone</span>
              </li>
              <li>
                <span className="login-welcome-num">2</span>
                <span>Tap the <strong>Share button</strong> <span className="login-welcome-icon">⎋</span> at the bottom of the screen</span>
              </li>
              <li>
                <span className="login-welcome-num">3</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
              </li>
              <li>
                <span className="login-welcome-num">4</span>
                <span>Tap <strong>Add</strong> in the top right</span>
              </li>
              <li>
                <span className="login-welcome-num">5</span>
                <span><strong>Close Safari</strong> and open Huddle from your home screen</span>
              </li>
              <li>
                <span className="login-welcome-num">6</span>
                <span>Come back here and tap <strong>"I have an invite code"</strong></span>
              </li>
            </ol>
            <button className="login-btn" onClick={() => setStep(STEPS.INVITE_CODE)}>
              I've added it — continue
            </button>
            <button className="login-resend-btn" onClick={() => setStep(STEPS.INVITE_CODE)}>
              Skip this, I'll do it later
            </button>
          </div>
        )}

        {/* ── Enter invite code ── */}
        {step === STEPS.INVITE_CODE && (
          <form className="login-form" onSubmit={handleInviteCode}>
            <label className="login-label">Enter your invite code</label>
            <input
              type="text" className="login-input login-input-code"
              placeholder="e.g. GRACE42"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              disabled={loading} autoFocus maxLength={12}
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading || !inviteCode.trim()}>
              {loading ? 'Checking…' : 'Continue'}
            </button>
            <button type="button" className="login-resend-btn" onClick={() => { setStep(STEPS.LANDING); setError(''); }}>
              ← Back
            </button>
          </form>
        )}

        {/* ── What's your name ── */}
        {step === STEPS.INVITE_NAME && (
          <form className="login-form" onSubmit={handleNameSubmit}>
            <p className="login-otp-prompt">
              You're joining<br /><strong>{huddle?.name}</strong>
            </p>
            <label className="login-label">What should we call you?</label>
            <input
              type="text" className="login-input"
              placeholder="Your first name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus maxLength={40} required
            />
            <button type="submit" className="login-btn" disabled={!name.trim()}>
              Continue
            </button>
          </form>
        )}

        {/* ── New user email ── */}
        {step === STEPS.INVITE_EMAIL && (
          <form className="login-form" onSubmit={handleInviteEmail}>
            <label className="login-label">Your email address</label>
            <input
              type="email" className="login-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading} autoFocus required
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="login-fine-print">We'll email you a 6-digit code to verify.</p>
          </form>
        )}

        {/* ── Create: What's your name ── */}
        {step === STEPS.CREATE_NAME && (
          <form className="login-form" onSubmit={handleCreateNameSubmit}>
            <p className="login-otp-prompt">Let's set up your Huddle</p>
            <label className="login-label">What should we call you?</label>
            <input
              type="text" className="login-input"
              placeholder="Your first name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus maxLength={40} required
            />
            <button type="submit" className="login-btn" disabled={!name.trim()}>
              Continue
            </button>
            <button type="button" className="login-resend-btn" onClick={() => setStep(STEPS.LANDING)}>
              ← Back
            </button>
          </form>
        )}

        {/* ── Create: Email ── */}
        {step === STEPS.CREATE_EMAIL && (
          <form className="login-form" onSubmit={handleCreateEmail}>
            <label className="login-label">Your email address</label>
            <input
              type="email" className="login-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading} autoFocus required
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="login-fine-print">We'll email you a 6-digit code to verify.</p>
            <button type="button" className="login-resend-btn" onClick={() => setStep(STEPS.CREATE_NAME)}>
              ← Back
            </button>
          </form>
        )}

        {/* ── Returning user email ── */}
        {step === STEPS.EMAIL && (
          <form className="login-form" onSubmit={handleReturningEmail}>
            <label className="login-label">Your email address</label>
            <input
              type="email" className="login-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading} autoFocus required
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="login-fine-print">We'll email you a 6-digit code. No password needed.</p>
            <button type="button" className="login-resend-btn" onClick={() => { setStep(STEPS.LANDING); setError(''); }}>
              ← Back
            </button>
          </form>
        )}

        {/* ── OTP code entry ── */}
        {step === STEPS.CODE && (
          <div className="login-otp-section">
            <p className="login-otp-prompt">
              Enter the 6-digit code sent to<br /><strong>{email}</strong>
            </p>
            <div className="login-otp-boxes">
              {otpCode.map((digit, i) => (
                <input
                  key={i} ref={el => inputRefs.current[i] = el}
                  type="text" inputMode="numeric" maxLength={1}
                  className={`login-otp-box ${error ? 'error' : ''}`}
                  value={digit}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  disabled={loading}
                />
              ))}
            </div>
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" onClick={handleVerifyCode}
              disabled={loading || otpCode.join('').length < 6}>
              {loading ? 'Verifying…' : 'Verify code'}
            </button>
            <div className="login-otp-footer">
              <button className="login-resend-btn" onClick={handleResend}>
                {resent ? '✓ Code resent' : 'Resend code'}
              </button>
              <span className="login-otp-divider">·</span>
              <button className="login-resend-btn"
                onClick={() => { setStep(STEPS.EMAIL); setError(''); setOtpCode(['','','','','','']); }}>
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