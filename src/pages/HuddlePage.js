// ============================================================
// src/pages/HuddlePage.js
// ─────────────────────────────────────────────────────────────
// Single-scroll mobile layout. No panels, no columns.
// Structure:
//   Fixed header
//   Sticky word bar (letters toggle, multi-select)
//   Write Reflection prompt (appears when letters selected)
//   Feed (filters to selected letters)
//   Bottom tab bar (Feed · Share · Huddle)
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase, signOut }  from '../lib/supabaseClient';
import PostComposer           from '../components/PostComposer';
import PostCard               from '../components/PostCard';
import HuddleLogo             from '../assets/Huddle_Logo_Subject.png';

// ─────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────
const MOCK_HUDDLE = {
  id:           'huddle-001',
  name:         'Grace Girls',
  invite_token: 'abc123def456',
  member_count: 6,
};

const MOCK_WORD = {
  id:   'word-001',
  word: 'GRACE',
  letter_meanings: {
    G: 'Grateful',
    R: 'Rant',
    A: 'Aha',
    C: 'Challenge',
    E: 'Educate',
  },
  is_active: true,
};

const MOCK_POSTS = [
  {
    id: 'post-001', huddle_id: 'huddle-001', author_id: 'user-debbie',
    body: 'Had a quiet moment in the car and realized how much I take "normal days" for granted. Today felt simple, and that felt like a gift.',
    letters: ['G'], word_snapshot: 'GRACE',
    meanings_snapshot: { G: 'Grateful', R: 'Rant', A: 'Aha', C: 'Challenge', E: 'Educate' },
    photo_url: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    author: { username: 'Debbie', avatar_url: null },
    reactions: [
      { id: 'r1', user_id: 'user-ashley', reaction_type: 'heart' },
      { id: 'r2', user_id: 'user-megan',  reaction_type: 'heart' },
      { id: 'r3', user_id: 'user-sara',   reaction_type: 'heart' },
      { id: 'r4', user_id: 'user-kim',    reaction_type: 'heart' },
    ],
    comment_count: 1,
  },
  {
    id: 'post-002', huddle_id: 'huddle-001', author_id: 'user-ashley',
    body: "Wanted to snap during a stressful moment — didn't. I paused, breathed, and chose a softer answer. I'm proud of that.",
    letters: ['R', 'G'], word_snapshot: 'GRACE',
    meanings_snapshot: { G: 'Grateful', R: 'Rant', A: 'Aha', C: 'Challenge', E: 'Educate' },
    photo_url: null,
    created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    author: { username: 'Ashley', avatar_url: null },
    reactions: Array(9).fill(null).map((_, i) => ({ id: `r-a${i}`, user_id: `user-${i}`, reaction_type: 'heart' })),
    comment_count: 2,
  },
  {
    id: 'post-003', huddle_id: 'huddle-001', author_id: 'user-megan',
    body: 'Texted a friend who\'s been quiet lately — nothing big, just "thinking of you." She replied right away. Sometimes encouragement is just showing up.',
    letters: ['E'], word_snapshot: 'GRACE',
    meanings_snapshot: { G: 'Grateful', R: 'Rant', A: 'Aha', C: 'Challenge', E: 'Educate' },
    photo_url: null,
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    author: { username: 'Megan', avatar_url: null },
    reactions: Array(6).fill(null).map((_, i) => ({ id: `r-m${i}`, user_id: `user-${i}`, reaction_type: 'heart' })),
    comment_count: 0,
  },
  {
    id: 'post-004', huddle_id: 'huddle-001', author_id: 'user-sara',
    body: 'Finally said the thing I\'ve been sitting on for weeks. It landed better than I expected. Turns out people can handle honesty when it comes with kindness.',
    letters: ['C', 'A'], word_snapshot: 'GRACE',
    meanings_snapshot: { G: 'Grateful', R: 'Rant', A: 'Aha', C: 'Challenge', E: 'Educate' },
    photo_url: null,
    created_at: new Date(Date.now() - 3600000 * 120).toISOString(),
    author: { username: 'Sara', avatar_url: null },
    reactions: Array(11).fill(null).map((_, i) => ({ id: `r-s${i}`, user_id: `user-${i}`, reaction_type: 'heart' })),
    comment_count: 3,
  },
];

// ─────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────
const TABS = { FEED: 'feed', HUDDLE: 'huddle' };

// Soft prompts per letter
const LETTER_PROMPTS = {
  G: 'Especially thankful for something today?',
  R: 'What got you fired up?',
  A: 'Did something click?',
  C: 'Challenging day? Or did you challenge someone?',
  E: 'Today I learned… or did you teach someone?',
};

export default function HuddlePage({ session }) {
  const currentUserId = session?.user?.id;

  const [activeTab,       setActiveTab]       = useState(TABS.FEED);
  const [huddle,          setHuddle]          = useState(MOCK_HUDDLE);
  const [activeWord,      setActiveWord]      = useState(MOCK_WORD);
  const [posts,           setPosts]           = useState(MOCK_POSTS);
  const [selectedLetters, setSelectedLetters] = useState([]); // multi-select
  const [composerOpen,    setComposerOpen]    = useState(false);
  const [composerLetters, setComposerLetters] = useState([]);
  const [inviteCopied,    setInviteCopied]    = useState(false);

  // ── Real Supabase fetch stub ────────────
  useEffect(() => {
    /*
    async function load() {
      const { data: membership } = await supabase
        .from('huddle_members').select('huddle_id').eq('user_id', currentUserId).single();
      if (!membership) return;
      const { data: huddleData } = await supabase
        .from('huddles').select('*').eq('id', membership.huddle_id).single();
      setHuddle(huddleData);
      const { data: wordData } = await supabase
        .from('huddle_words').select('*').eq('huddle_id', membership.huddle_id).eq('is_active', true).single();
      if (wordData) setActiveWord(wordData);
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:profiles(username, avatar_url), reactions(*), comment_count:comments(count)')
        .eq('huddle_id', membership.huddle_id)
        .order('created_at', { ascending: false });
      if (postsData) setPosts(postsData);
    }
    load();
    */
  }, [currentUserId]);

  // ── Toggle a letter — single select only ──
  function toggleLetter(letter) {
    setSelectedLetters(prev =>
      prev.includes(letter) ? [] : [letter]
    );
  }

  // ── Filtered posts ──────────────────────
  const visiblePosts = selectedLetters.length > 0
    ? posts.filter(post => post.letters.some(l => selectedLetters.includes(l)))
    : posts;

  // ── Open composer ───────────────────────
  function openComposer(letters = []) {
    setComposerLetters(letters);
    setComposerOpen(true);
  }

  function handlePostCreated(newPost) {
    setPosts(prev => [newPost, ...prev]);
    setSelectedLetters([]);
    setActiveTab(TABS.FEED);
  }

  function handleCopyInvite() {
    const url = `${window.location.origin}/invite/${huddle?.invite_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    });
  }

  // ── Prompt text for selected letter ──
  const promptText = selectedLetters.length === 1
    ? LETTER_PROMPTS[selectedLetters[0]]
    : null;

  const letterMeanings = activeWord?.letter_meanings || {};
  const letters = activeWord?.word?.split('') || [];

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div className="huddle-page">

      {/* ── Faint watermark ── */}
      <div className="huddle-watermark" aria-hidden="true">
        <img src={HuddleLogo} alt="" />
      </div>

      {/* ══ Header ══════════════════════════ */}
      <header className="huddle-header">
        <div className="huddle-header-brand">
          <img src={HuddleLogo} alt="Huddle" className="huddle-logo-img" />
          <div>
            <h1 className="huddle-header-title">Huddle</h1>
            <p className="huddle-header-sub">A simple way to stay close, even on ordinary days.</p>
          </div>
        </div>
        <button className="huddle-signout-btn" onClick={signOut} title="Sign out">↩</button>
      </header>

      {/* ══ Sticky Word Bar ══════════════════ */}
      <div className="word-bar">
        <div className="word-bar-inner">
          {letters.map(letter => (
            <button
              key={letter}
              className={`word-pill ${selectedLetters.includes(letter) ? 'selected' : ''}`}
              onClick={() => toggleLetter(letter)}
            >
              <span className="word-pill-letter">{letter}</span>
              <span className="word-pill-meaning">{letterMeanings[letter]}</span>
            </button>
          ))}
        </div>

        {/* Write Reflection button — slides in when letters selected */}
        <div className={`word-bar-cta ${selectedLetters.length > 0 ? 'visible' : ''}`}>
          <button
            className="write-reflection-btn"
            onClick={() => openComposer(selectedLetters)}
          >
            ✦ Write Reflection
          </button>
          <button
            className="word-bar-clear"
            onClick={() => setSelectedLetters([])}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ══ Main content ════════════════════ */}
      <main className="huddle-main">

        {/* ── FEED TAB ── */}
        {activeTab === TABS.FEED && (
          <div className="feed-view">

            {/* Soft prompt when letters selected */}
            {promptText && (
              <div className="feed-prompt">
                <p className="feed-prompt-text">{promptText}</p>
              </div>
            )}

            {/* Posts */}
            {visiblePosts.length === 0 ? (
              <div className="feed-empty">
                <p>
                  {selectedLetters.length > 0
                    ? `No reflections tagged ${selectedLetters.join(' or ')} yet.`
                    : 'No reflections yet. Be the first.'}
                </p>
                <button
                  className="feed-empty-btn"
                  onClick={() => openComposer(selectedLetters)}
                >
                  Write the first reflection
                </button>
              </div>
            ) : (
              <div className="feed-list">
                {visiblePosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    letterMeanings={letterMeanings}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HUDDLE TAB ── */}
        {activeTab === TABS.HUDDLE && (
          <div className="huddle-view">
            <img src={HuddleLogo} alt="Huddle" className="huddle-view-logo" />
            <h2 className="huddle-view-name">Some days it's gratitude. Some days it's honesty. Some days it's a lesson learned.</h2>
            <p className="huddle-view-sub">Pop in, share a thought, keep going.</p>

            <div className="huddle-view-word">
              <p className="huddle-view-word-label">{activeWord?.word}</p>
              {letters.map(letter => (
                <div key={letter} className="huddle-view-meaning-row">
                  <span className="huddle-view-letter">{letter}</span>
                  <span className="huddle-view-meaning">{letterMeanings[letter]}</span>
                </div>
              ))}
            </div>

            <div className="huddle-view-actions">
              <button className="huddle-view-invite-btn" onClick={handleCopyInvite}>
                {inviteCopied ? '✓ Invite link copied' : '🔗 Copy invite link'}
              </button>
              <button className="huddle-view-signout-btn" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ══ Bottom Tab Bar ════════════════════ */}
      <nav className="tab-bar">
        <button
          className={`tab-btn ${activeTab === TABS.FEED ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.FEED)}
        >
          <span className="tab-icon">📜</span>
          <span className="tab-label">Feed</span>
        </button>

        {/* Center compose — raised */}
        <button className="tab-btn tab-compose" onClick={() => openComposer(selectedLetters)}>
          <span className="tab-compose-bubble">✦</span>
          <span className="tab-label">Share</span>
        </button>

        <button
          className={`tab-btn ${activeTab === TABS.HUDDLE ? 'active' : ''}`}
          onClick={() => setActiveTab(TABS.HUDDLE)}
        >
          <span className="tab-icon">☽</span>
          <span className="tab-label">Huddle</span>
        </button>
      </nav>

      {/* ══ Composer ═════════════════════════ */}
      <PostComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPostCreated={handlePostCreated}
        initialLetters={composerLetters}
        word={activeWord?.word || ''}
        letterMeanings={letterMeanings}
        huddleId={huddle?.id}
        userId={currentUserId}
      />
    </div>
  );
}