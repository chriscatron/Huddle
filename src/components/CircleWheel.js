// ============================================================
// src/components/CircleWheel.js
// ─────────────────────────────────────────────────────────────
// Renders the foundation word (e.g. "GRACE") in the center,
// with each letter positioned around it in a circle.
// Clicking a letter opens the PostComposer pre-tagged with that letter.
// Multiple letters can be selected before composing.
// ─────────────────────────────────────────────────────────────
// Props:
//   word           {string}   e.g. "GRACE"
//   letterMeanings {object}   e.g. { G: "Grateful", R: "Rant", ... }
//   onCompose      {function} called with selected letters array when user clicks compose
//   memberCount    {number}   shown in the panel header
// ============================================================

import React, { useState } from 'react';

export default function CircleWheel({ word = 'GRACE', letterMeanings = {}, onCompose, memberCount = 0 }) {
  // Track which letters are currently selected (can be multiple)
  const [selected, setSelected] = useState([]);

  const letters = word.toUpperCase().split('');

  // ─────────────────────────────────────────
  // Position each letter around the circle
  // Letters are evenly spaced on a circle of radius R
  // Starting from the top (−90°) going clockwise
  // ─────────────────────────────────────────
  const RADIUS  = 100; // px from center to letter node
  const CENTER  = 160; // center of the SVG viewport (320 / 2)

  function getLetterPosition(index, total) {
    const angleDeg  = (index / total) * 360 - 90;
    const angleRad  = (angleDeg * Math.PI) / 180;
    return {
      x: CENTER + RADIUS * Math.cos(angleRad),
      y: CENTER + RADIUS * Math.sin(angleRad),
    };
  }

  // ─────────────────────────────────────────
  // Toggle a letter in/out of selection
  // ─────────────────────────────────────────
  function toggleLetter(letter) {
    setSelected(prev =>
      prev.includes(letter)
        ? prev.filter(l => l !== letter)
        : [...prev, letter]
    );
  }

  // ─────────────────────────────────────────
  // Fire composer and reset selection
  // ─────────────────────────────────────────
  function handleCompose() {
    if (onCompose) onCompose(selected);
    setSelected([]);
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="wheel-panel">

      {/* Panel header */}
      <div className="wheel-header">
        <div>
          <h2 className="wheel-word-title">{word}</h2>
          <p className="wheel-subtitle">Tap a letter to tag your reflection</p>
        </div>
        <span className="wheel-member-badge">
          <span className="wheel-member-dot" />
          Private huddle · {memberCount} members
        </span>
      </div>

      {/* SVG Wheel */}
      <div className="wheel-container">
        <svg
          viewBox="0 0 320 320"
          width="280"
          height="280"
          className="wheel-svg"
          aria-label={`${word} letter wheel`}
        >
          {/* Dashed orbit ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(160, 120, 220, 0.25)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />

          {/* Center word */}
          <text
            x={CENTER}
            y={CENTER + 8}
            textAnchor="middle"
            className="wheel-center-text"
            fontSize="32"
            fontWeight="700"
            letterSpacing="4"
          >
            {word}
          </text>

          {/* Compose prompt below word (only when letters selected) */}
          {selected.length > 0 && (
            <text
              x={CENTER}
              y={CENTER + 30}
              textAnchor="middle"
              className="wheel-compose-hint"
              fontSize="10"
            >
              tap compose ↓
            </text>
          )}

          {/* Letter nodes */}
          {letters.map((letter, i) => {
            const { x, y }   = getLetterPosition(i, letters.length);
            const isSelected = selected.includes(letter);

            return (
              <g
                key={`${letter}-${i}`}
                className={`wheel-letter-group ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleLetter(letter)}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${letter} — ${letterMeanings[letter] || ''}`}
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && toggleLetter(letter)}
              >
                {/* Letter background circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={22}
                  className={`wheel-letter-bg ${isSelected ? 'selected' : ''}`}
                />

                {/* The letter itself */}
                <text
                  x={x}
                  y={y + 6}
                  textAnchor="middle"
                  className={`wheel-letter-char ${isSelected ? 'selected' : ''}`}
                  fontSize="18"
                  fontWeight="600"
                >
                  {letter}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Compose button — appears when at least one letter is selected */}
      <div className={`wheel-compose-area ${selected.length > 0 ? 'visible' : ''}`}>
        <p className="wheel-selected-label">
          {selected.length > 0
            ? `Tagged: ${selected.map(l => `${l} · ${letterMeanings[l] || l}`).join(', ')}`
            : 'No letters selected'}
        </p>
        <button
          className="wheel-compose-btn"
          onClick={handleCompose}
          disabled={selected.length === 0}
        >
          + Write reflection
        </button>
      </div>

      {/* Letter legend */}
      <div className="wheel-legend">
        {letters.map((letter, i) => (
          <button
            key={`legend-${letter}-${i}`}
            className={`wheel-legend-item ${selected.includes(letter) ? 'selected' : ''}`}
            onClick={() => toggleLetter(letter)}
            aria-label={`${letter} — ${letterMeanings[letter] || ''}`}
          >
            <span className="wheel-legend-letter">{letter}</span>
            <span className="wheel-legend-meaning">
              {letterMeanings[letter] || '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}