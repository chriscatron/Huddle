// ============================================================
// src/components/CreateHuddle.js
// ─────────────────────────────────────────────────────────────
// Founder-only flow to create a new huddle.
// Steps:
//   1. Name the huddle
//   2. Set the word + letter meanings
//   3. Confirm → huddle created → show invite code
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const STEPS = {
  NAME:    'name',
  WORD:    'word',
  CONFIRM: 'confirm',
  DONE:    'done',
};

function generateCode(word) {
  const clean = word.replace(/[^A-Z]/g, '').toUpperCase().slice(0, 6);
  const num = Math.floor(10 + Math.random() * 90);
  return `${clean}${num}`;
}

export default function CreateHuddle({ session, onHuddleCreated, onCancel }) {
  const [step,     setStep]     = useState(STEPS.NAME);
  const [name,     setName]     = useState('');
  const [word,     setWord]     = useState('');
  const [meanings, setMeanings] = useState({});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [code,     setCode]     = useState('');

  // Lock body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const letters = word.toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean);
  const uniqueLetters = [...new Set(letters)];

  function handleWordChange(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
    setWord(val);
    // Init meanings for new letters
    const newMeanings = { ...meanings };
    val.split('').forEach(l => { if (!newMeanings[l]) newMeanings[l] = ''; });
    setMeanings(newMeanings);
  }

  async function handleCreate() {
    setLoading(true);
    setError('');

    const inviteToken = generateCode(word);
    const letterMeanings = {};
    uniqueLetters.forEach(l => { letterMeanings[l] = meanings[l] || l; });

    // Create huddle
    const { data: huddle, error: huddleError } = await supabase
      .from('huddles')
      .insert({
        name,
        founder_id:   session.user.id,
        invite_token: inviteToken,
      })
      .select()
      .single();

    if (huddleError) {
      setError('Could not create huddle. Please try again.');
      setLoading(false);
      return;
    }

    // Create active word
    await supabase.from('huddle_words').insert({
      huddle_id:       huddle.id,
      word:            word.toUpperCase(),
      letter_meanings: letterMeanings,
      is_active:       true,
    });

    // Add founder as member
    await supabase.from('huddle_members').insert({
      huddle_id: huddle.id,
      user_id:   session.user.id,
    });

    setCode(inviteToken);
    setLoading(false);
    setStep(STEPS.DONE);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="composer-backdrop" onClick={onCancel} aria-hidden="true" />

      {/* Sheet */}
      <div className="composer-modal" role="dialog" aria-modal="true" aria-label="Create a Huddle">
        <div className="create-huddle-header">
          <h2 className="create-huddle-title">Create a Huddle</h2>
          <button className="create-huddle-close" onClick={onCancel}>✕</button>
        </div>

        {/* Step 1 — Name */}
        {step === STEPS.NAME && (
          <div className="create-huddle-step">
            <label className="create-huddle-label">What's the name of your Huddle?</label>
            <input
              type="text" className="create-huddle-input"
              placeholder="e.g. Grace Girls, The Squad…"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40} autoFocus
            />
            <p className="create-huddle-hint">This is what your members will see.</p>
            <button
              className="create-huddle-btn"
              onClick={() => setStep(STEPS.WORD)}
              disabled={!name.trim()}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Word */}
        {step === STEPS.WORD && (
          <div className="create-huddle-step">
            <label className="create-huddle-label">What's your word?</label>
            <input
              type="text" className="create-huddle-input create-huddle-word-input"
              placeholder="e.g. GRACE, FAITH, RISE…"
              value={word}
              onChange={handleWordChange}
              maxLength={8} autoFocus
            />
            <p className="create-huddle-hint">Each letter will be a reflection prompt for your members.</p>

            {uniqueLetters.length > 0 && (
              <div className="create-huddle-meanings">
                {uniqueLetters.map(letter => (
                  <div key={letter} className="create-huddle-meaning-row">
                    <span className="create-huddle-letter">{letter}</span>
                    <input
                      type="text"
                      className="create-huddle-meaning-input"
                      placeholder={`What does ${letter} stand for?`}
                      value={meanings[letter] || ''}
                      onChange={e => setMeanings(prev => ({ ...prev, [letter]: e.target.value }))}
                      maxLength={30}
                    />
                  </div>
                ))}
              </div>
            )}

            {error && <p className="create-huddle-error">{error}</p>}

            <button
              className="create-huddle-btn"
              onClick={handleCreate}
              disabled={loading || !word || uniqueLetters.some(l => !meanings[l]?.trim())}
            >
              {loading ? 'Creating…' : 'Create Huddle'}
            </button>
            <button className="create-huddle-back" onClick={() => setStep(STEPS.NAME)}>
              ← Back
            </button>
          </div>
        )}

        {/* Done — show invite code */}
        {step === STEPS.DONE && (
          <div className="create-huddle-step create-huddle-done">
            <div className="create-huddle-success-icon">🎉</div>
            <h3 className="create-huddle-success-title">{name} is ready!</h3>
            <p className="create-huddle-hint">Share this invite code with your people:</p>
            <div className="create-huddle-code">{code}</div>
            <p className="create-huddle-hint">Anyone with this code can join your Huddle.</p>
            <button
              className="create-huddle-btn"
              onClick={() => {
                navigator.clipboard.writeText(code);
              }}
            >
              Copy code
            </button>
            <button
              className="create-huddle-btn create-huddle-btn-secondary"
              onClick={() => onHuddleCreated()}
            >
              Go to my Huddle
            </button>
          </div>
        )}

      </div>
    </>
  );
}