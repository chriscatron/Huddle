// ============================================================
// src/components/PostComposer.js
// ─────────────────────────────────────────────────────────────
// Modal for writing a new post / reflection.
// Pre-populated with letters selected from the CircleWheel.
// User can add/remove letters, write their reflection,
// and optionally attach a photo.
// ─────────────────────────────────────────────────────────────
// Props:
//   isOpen         {bool}     controls visibility
//   onClose        {function} called when modal is dismissed
//   onPostCreated  {function} called after successful post creation
//   initialLetters {string[]} pre-selected letters from the wheel
//   word           {string}   current active word (e.g. "GRACE")
//   letterMeanings {object}   { G: "Grateful", R: "Rant", ... }
//   huddleId       {string}   UUID of the user's huddle
//   userId         {string}   UUID of the current user
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

const LETTER_PROMPTS = {
  G: 'Especially thankful for something today?',
  R: 'What got you fired up?',
  A: 'Did something click?',
  C: 'Challenging day? Or did you challenge someone?',
  E: 'Today I learned… or did you teach someone?',
};

export default function PostComposer({
  isOpen,
  onClose,
  onPostCreated,
  initialLetters = [],
  word           = '',
  letterMeanings = {},
  huddleId,
  userId,
}) {
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [body,            setBody]            = useState('');
  const [photoFile,       setPhotoFile]       = useState(null);
  const [photoPreview,    setPhotoPreview]    = useState(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState('');

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const letters = word.toUpperCase().split('');

  // ─────────────────────────────────────────
  // Sync pre-selected letters when modal opens
  // ─────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setSelectedLetters(initialLetters);
      setBody('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setError('');
      // Focus textarea after modal open animation
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialLetters]);

  // ─────────────────────────────────────────
  // Close on Escape key
  // ─────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ─────────────────────────────────────────
  // Toggle a letter tag
  // ─────────────────────────────────────────
  function toggleLetter(letter) {
    setSelectedLetters(prev =>
      prev.includes(letter) ? [] : [letter]
    );
  }

  // ─────────────────────────────────────────
  // Photo picker
  // ─────────────────────────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─────────────────────────────────────────
  // Upload photo to Supabase Storage
  // Returns the public URL or null on failure
  // ─────────────────────────────────────────
  async function uploadPhoto(file) {
    const ext      = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('post-photos')          // create this bucket in Supabase Storage
      .upload(fileName, file, { upsert: false });

    if (uploadError) {
      console.error('[Huddle] Photo upload error:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage
      .from('post-photos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  // ─────────────────────────────────────────
  // Submit the post
  // ─────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    if (!body.trim())              return setError('Please write something first.');
    if (selectedLetters.length === 0) return setError('Pick at least one letter to tag.');

    setSubmitting(true);
    setError('');

    // Upload photo if one was selected
    let photoUrl = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile);
      // Don't block the post if photo upload fails — just skip it
    }

    // ── Real Supabase insert ──────────────────
    const { data, error: insertError } = await supabase
      .from('posts')
      .insert({
        huddle_id:         huddleId,
        author_id:         userId,
        body:              body.trim(),
        letters:           selectedLetters,
        word_snapshot:     word,
        meanings_snapshot: letterMeanings,
        photo_url:         photoUrl,
      })
      .select('*, author:profiles(username, avatar_url)')
      .single();

    if (insertError) {
      setError('Could not save your reflection. Please try again.');
      setSubmitting(false);
      return;
    }

    if (onPostCreated) onPostCreated(data);

    setSubmitting(false);
    onClose();
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div className="composer-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="composer-modal" role="dialog" aria-modal="true" aria-label="Write a reflection">
        {/* Header */}
        <div className="composer-header">
          <div>
            <h2 className="composer-title">New Reflection</h2>
            <p className="composer-subtitle">Share what's on your heart today… no pressure, no perfect wording.</p>
          </div>
          <button className="composer-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="composer-form">
          {/* Letter tags — single select */}
          <div className="composer-tags-section">
            <p className="composer-tags-label">What's this about?</p>
            <div className="composer-tags-row">
              {letters.map((letter, i) => {
                const isActive = selectedLetters.includes(letter);
                return (
                  <button
                    key={`tag-${letter}-${i}`}
                    type="button"
                    className={`composer-tag ${isActive ? 'active' : ''}`}
                    onClick={() => toggleLetter(letter)}
                    aria-pressed={isActive}
                  >
                    <span className="composer-tag-letter">{letter}</span>
                    <span className="composer-tag-meaning">
                      {letterMeanings[letter] || ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text area */}
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder={
              selectedLetters.length === 1
                ? LETTER_PROMPTS[selectedLetters[0]]
                : 'Choose a letter above to get started…'
            }
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            maxLength={1000}
            disabled={submitting}
          />
          <p className="composer-char-count">{body.length} / 1000</p>

          {/* Photo section */}
          {photoPreview ? (
            <div className="composer-photo-preview">
              <img src={photoPreview} alt="Preview" className="composer-photo-img" />
              <button
                type="button"
                className="composer-photo-remove"
                onClick={removePhoto}
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="composer-photo-label">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="composer-file-input"
                onChange={handlePhotoChange}
                disabled={submitting}
              />
              <span className="composer-photo-btn">📷 Add a photo</span>
            </label>
          )}

          {/* Error */}
          {error && <p className="composer-error">{error}</p>}

          {/* Actions */}
          <div className="composer-actions">
            <button type="button" className="composer-cancel-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="composer-submit-btn"
              disabled={submitting || !body.trim() || selectedLetters.length === 0}
            >
              {submitting ? 'Sharing…' : 'Share reflection'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}