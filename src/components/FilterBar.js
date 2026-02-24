// ============================================================
// src/components/FilterBar.js
// ─────────────────────────────────────────────────────────────
// Filter tabs (All + one per letter) and a search input.
// Controlled component — parent owns the filter/search state.
// ─────────────────────────────────────────────────────────────
// Props:
//   word           {string}    e.g. "GRACE"
//   activeFilter   {string}    "ALL" or a single letter e.g. "G"
//   onFilterChange {function}  called with new filter string
//   searchQuery    {string}    current search text
//   onSearchChange {function}  called with new search string
//   postCounts     {object}    { ALL: 12, G: 3, R: 2, ... } optional
// ============================================================

import React from 'react';

export default function FilterBar({
  word           = '',
  activeFilter   = 'ALL',
  onFilterChange = () => {},
  searchQuery    = '',
  onSearchChange = () => {},
  postCounts     = {},
}) {
  const letters = word.toUpperCase().split('').filter(Boolean);

  // All tabs: "ALL" first, then each letter
  const tabs = ['ALL', ...letters];

  return (
    <div className="filterbar">
      {/* Filter tabs */}
      <div className="filterbar-tabs" role="tablist" aria-label="Filter posts by letter">
        {tabs.map(tab => {
          const isActive = activeFilter === tab;
          const count    = postCounts[tab];

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              className={`filterbar-tab ${isActive ? 'active' : ''}`}
              onClick={() => onFilterChange(tab)}
            >
              {tab === 'ALL' ? 'All' : tab}
              {/* Show count badge if we have data */}
              {count !== undefined && (
                <span className="filterbar-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="filterbar-search-wrap">
        <span className="filterbar-search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          className="filterbar-search"
          placeholder="Search reflections…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Search posts"
        />
        {/* Clear button */}
        {searchQuery && (
          <button
            className="filterbar-clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}