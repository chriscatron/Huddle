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

import React, { useState, useEffect, useRef } from 'react';
import { supabase, signOut } from '../lib/supabaseClient';
import PostComposer           from '../components/PostComposer';
import PostCard               from '../components/PostCard';
import CreateHuddle           from '../components/CreateHuddle';
import HuddleLogo             from '../assets/Huddle_Logo_Subject.png';


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

export default function HuddlePage({ session, isFounder }) {
  const currentUserId = session?.user?.id;

  const [activeTab,         setActiveTab]         = useState(TABS.FEED);
  const [huddle,            setHuddle]            = useState(null);
  const [activeWord,        setActiveWord]        = useState(null);
  const [posts,             setPosts]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [members,           setMembers]           = useState([]);
  const [membersOpen,       setMembersOpen]       = useState(false);
  const [selectedLetters,   setSelectedLetters]   = useState([]);
  const [composerOpen,      setComposerOpen]      = useState(false);
  const [composerLetters,   setComposerLetters]   = useState([]);
  const [inviteCopied,      setInviteCopied]      = useState(false);
  const [createHuddleOpen,  setCreateHuddleOpen]  = useState(false);
  const [newPostCount,      setNewPostCount]       = useState(0);
  const huddleIdRef = useRef(null);

  // ── Real Supabase fetch ─────────────────
  useEffect(() => {
    if (!currentUserId) return;

    async function load() {
      try {
        setLoading(true);

        // 1. Get huddle membership
        const { data: membership } = await supabase
          .from('huddle_members')
          .select('huddle_id')
          .eq('user_id', currentUserId)
          .single();

        if (!membership) {
          setLoading(false);
          return;
        }

        // 2. Load huddle details
        const { data: huddleData } = await supabase
          .from('huddles')
          .select('*')
          .eq('id', membership.huddle_id)
          .single();

        if (huddleData) setHuddle(huddleData);

        // 3. Load active word
        const { data: wordData } = await supabase
          .from('huddle_words')
          .select('*')
          .eq('huddle_id', membership.huddle_id)
          .eq('is_active', true)
          .single();

        if (wordData) setActiveWord(wordData);

        // 4. Load posts with author, reactions, comment count
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, author:profiles(username, avatar_url), reactions(*), comments(count)')
          .eq('huddle_id', membership.huddle_id)
          .order('created_at', { ascending: false });

        if (postsData) {
          postsData.forEach(p => {
            p.comment_count = p.comments?.[0]?.count ?? 0;
            delete p.comments;
          });
          setPosts(postsData);
        }

        huddleIdRef.current = membership.huddle_id;
        setLoading(false);

        // 5. Load members (non-blocking)
        supabase
          .rpc('get_huddle_members', { p_huddle_id: membership.huddle_id })
          .then(({ data: membersData }) => {
            if (membersData) setMembers(membersData);
          });

      } catch (err) {
        console.error('[Huddle] load error:', err);
        setLoading(false);
      }
    }

    load();

    // Real-time subscription for new posts
    let channel;
    const setupChannel = () => {
      if (!huddleIdRef.current) return;
      channel = supabase
        .channel('posts-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `huddle_id=eq.${huddleIdRef.current}`,
        }, async (payload) => {
          // Fetch full post with author and reactions
          const { data } = await supabase
            .from('posts')
            .select('*, author:profiles(username, avatar_url), reactions(*), comments(count)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            data.comment_count = data.comments?.[0]?.count ?? 0;
            delete data.comments;

            // Only add if not our own post (we already added it optimistically)
            if (data.author_id !== currentUserId) {
              setPosts(prev => {
                // Avoid duplicates
                if (prev.some(p => p.id === data.id)) return prev;
                setNewPostCount(c => c + 1);
                return [data, ...prev];
              });
            }
          }
        })
        .subscribe();
    };

    // Wait for load to set huddleId then subscribe
    setTimeout(setupChannel, 2000);

    return () => {
      if (channel) supabase.removeChannel(channel);
    };

  }, [currentUserId]);

  // ── Toggle a letter — single select only ──
  function toggleLetter(letter) {
    setSelectedLetters(prev =>
      prev.includes(letter) ? [] : [letter]
    );
  }

  function switchToFeed() {
    setActiveTab(TABS.FEED);
    setNewPostCount(0);
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

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p className="loading-text">Loading your huddle…</p>
      </div>
    );
  }

  if (!huddle) {
    return (
      <div className="app-loading">
        {isFounder ? (
          <>
            <p className="loading-text">You don't have a Huddle yet.</p>
            <button
              className="login-btn"
              style={{ marginTop: 16, maxWidth: 240 }}
              onClick={() => setCreateHuddleOpen(true)}
            >
              Create a Huddle
            </button>
            {createHuddleOpen && (
              <CreateHuddle
                session={session}
                onHuddleCreated={() => window.location.reload()}
                onCancel={() => setCreateHuddleOpen(false)}
              />
            )}
          </>
        ) : (
          <p className="loading-text">You're not in a Huddle yet.</p>
        )}
        <button onClick={signOut} style={{ marginTop: 16, color: '#7b6aad', fontSize: 14 }}>
          Sign out
        </button>
      </div>
    );
  }

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
        <button className="huddle-signout-btn" style={{visibility:'hidden'}} title="">↩</button>
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

            {/* Members — shown first */}
            <div className="huddle-view-members">
              <button
                className="huddle-view-members-btn"
                onClick={() => setMembersOpen(o => !o)}
              >
                👥 {members.length} {members.length === 1 ? 'member' : 'members'} {membersOpen ? '▲' : '▼'}
              </button>

              {membersOpen && (
                <div className="huddle-members-list">
                  {members.map((m, i) => {
                    const name = m?.username || '?';
                    const initials = name.slice(0, 2).toUpperCase();
                    return (
                      <div key={i} className="huddle-member-row">
                        <div className="huddle-member-avatar">{initials}</div>
                        <span className="huddle-member-name">{name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Word — compact */}
            <div className="huddle-view-word">
              <p className="huddle-view-word-label">{activeWord?.word}</p>
              <div className="huddle-view-meanings-compact">
                {letters.map(letter => (
                  <div key={letter} className="huddle-view-meaning-row">
                    <span className="huddle-view-letter">{letter}</span>
                    <span className="huddle-view-meaning">{letterMeanings[letter]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="huddle-view-actions">
              {isFounder && (
                <button
                  className="huddle-view-invite-btn"
                  onClick={() => setCreateHuddleOpen(true)}
                >
                  ✦ Create a new Huddle
                </button>
              )}
              <button className="huddle-view-invite-btn" onClick={handleCopyInvite}>
                {inviteCopied ? '✓ Invite code copied' : '🔗 Copy invite code'}
              </button>
              <button className="huddle-view-signout-btn" onClick={signOut}>
                Sign out
              </button>
            </div>

            {createHuddleOpen && (
              <CreateHuddle
                session={session}
                onHuddleCreated={() => window.location.reload()}
                onCancel={() => setCreateHuddleOpen(false)}
              />
            )}
          </div>
        )}

      </main>

      {/* ══ Bottom Tab Bar ════════════════════ */}
      <nav className="tab-bar">
        <button
          className={`tab-btn ${activeTab === TABS.FEED ? 'active' : ''}`}
          onClick={switchToFeed}
        >
          <span className="tab-icon" style={{position:'relative'}}>
            📜
            {newPostCount > 0 && (
              <span className="tab-badge">{newPostCount}</span>
            )}
          </span>
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