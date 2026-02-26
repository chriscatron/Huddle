// ============================================================
// src/pages/NamePage.js
// ─────────────────────────────────────────────────────────────
// Shown once after first login — user sets their display name.
// Saves to profiles table then App.js routes to HuddlePage.
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import HuddleLogo from '../assets/Huddle_Logo_Subject.png';

export default function NamePage({ session, onNameSaved }) {
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', session.user.id);

    if (error) {
      setError('Could not save your name. Please try again.');
      setLoading(false);
      return;
    }

    onNameSaved(trimmed);
  }

  return (
    <div className="login-page">
      <div className="login-bg-overlay" />
      <div className="login-card">
        <div className="login-brand">
          <img src={HuddleLogo} alt="Huddle" className="login-logo-img" />
          <h1 className="login-title">Huddle</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="name" className="login-label">
            What should we call you?
          </label>
          <input
            id="name"
            type="text"
            className="login-input"
            placeholder="Your first name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={loading}
            autoFocus
            required
            maxLength={40}
          />

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>

          <p className="login-fine-print">
            This is how you'll appear to others in your Huddle.
          </p>
        </form>
      </div>
      <p className="login-footer">Stay connected through the real stuff.</p>
    </div>
  );
}