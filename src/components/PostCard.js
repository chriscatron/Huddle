// ============================================================
// src/components/PostCard.js
// ─────────────────────────────────────────────────────────────
// Renders a single post in the feed.
// Shows: author avatar + name, timestamp, letter tag(s),
//        post body, optional photo, reaction button, comment count.
// Clicking the comment count / reply area expands CommentThread.
// ─────────────────────────────────────────────────────────────
// Props:
//   post           {object}   full post object (see shape below)
//   currentUserId  {string}   logged-in user's UUID
//   letterMeanings {object}   { G: "Grateful", ... } for the current word
//                             (falls back to post.meanings_snapshot)
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CommentThread from './CommentThread';

// ─────────────────────────────────────────
// Expected post shape:
// {
//   id, huddle_id, author_id, body, letters[],
//   word_snapshot, meanings_snapshot{},
//   photo_url, created_at,
//   author: { username, avatar_url },
//   reactions: [{ id, user_id, reaction_type }],
//   comment_count: number,
// }
// ─────────────────────────────────────────

export default function PostCard({ post, currentUserId, letterMeanings = {} }) {
  const [reactions,     setReactions]     = useState(post.reactions || []);
  const [showComments,  setShowComments]  = useState(false);
  const [commentCount,  setCommentCount]  = useState(post.comment_count || 0);

  // Resolve meanings: prefer live letterMeanings, fall back to snapshot
  const meanings = { ...post.meanings_snapshot, ...letterMeanings };

  // Has the current user already reacted with a heart?
  const userHasReacted = reactions.some(
    r => r.user_id === currentUserId && r.reaction_type === 'heart'
  );
  const heartCount = reactions.filter(r => r.reaction_type === 'heart').length;

  // ─────────────────────────────────────────
  // Toggle heart reaction
  // ─────────────────────────────────────────
  async function handleReact() {
    if (!currentUserId) return;

    if (userHasReacted) {
      // Optimistic remove
      setReactions(prev => prev.filter(
        r => !(r.user_id === currentUserId && r.reaction_type === 'heart')
      ));
      await supabase
        .from('reactions')
        .delete()
        .match({ post_id: post.id, user_id: currentUserId, reaction_type: 'heart' });
    } else {
      // Optimistic add
      const optimistic = { id: `opt-${Date.now()}`, user_id: currentUserId, reaction_type: 'heart' };
      setReactions(prev => [...prev, optimistic]);

      const { data, error } = await supabase
        .from('reactions')
        .insert({ post_id: post.id, user_id: currentUserId, reaction_type: 'heart' })
        .select()
        .single();

      if (!error) {
        setReactions(prev => prev.map(r => r.id === optimistic.id ? data : r));
      } else {
        setReactions(prev => prev.filter(r => r.id !== optimistic.id));
      }
    }
  }

  // ─────────────────────────────────────────
  // Format timestamp
  // ─────────────────────────────────────────
  function formatTime(isoString) {
    const date = new Date(isoString);
    const now  = new Date();
    const diffMs   = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (diffDays === 0) return `Today · ${timeStr}`;
    if (diffDays === 1) return `Yesterday · ${timeStr}`;
    if (diffDays < 7)  return `${diffDays} days ago · ${timeStr}`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${timeStr}`;
  }

  // ─────────────────────────────────────────
  // Avatar initials fallback
  // ─────────────────────────────────────────
  function getInitials(username = '') {
    return username.slice(0, 2).toUpperCase() || '?';
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <article className="post-card">
      {/* ── Author row ── */}
      <div className="post-header">
        <div className="post-avatar">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt={post.author.username} />
          ) : (
            <span className="post-avatar-initials">
              {getInitials(post.author?.username)}
            </span>
          )}
        </div>
        <div className="post-meta">
          <span className="post-author">{post.author?.username || 'Member'}</span>
          <span className="post-time">{formatTime(post.created_at)}</span>
        </div>
      </div>

      {/* ── Letter tag(s) ── */}
      <div className="post-tags">
        {(post.letters || []).map((letter, i) => (
          <span key={`${letter}-${i}`} className={`post-tag post-tag-${letter.toLowerCase()}`}>
            <span className="post-tag-letter">{letter}</span>
            <span className="post-tag-dot">·</span>
            <span className="post-tag-meaning">{meanings[letter] || letter}</span>
          </span>
        ))}
        {/* Show the word snapshot so older posts stay in context */}
        {post.word_snapshot && (
          <span className="post-word-badge">{post.word_snapshot}</span>
        )}
      </div>

      {/* ── Post body ── */}
      <p className="post-body">{post.body}</p>

      {/* ── Optional photo ── */}
      {post.photo_url && (
        <div className="post-photo-wrap">
          <img
            src={post.photo_url}
            alt="Post attachment"
            className="post-photo"
            loading="lazy"
          />
        </div>
      )}

      {/* ── Reactions + Comments row ── */}
      <div className="post-actions">
        {/* Heart reaction */}
        <button
          className={`post-react-btn ${userHasReacted ? 'reacted' : ''}`}
          onClick={handleReact}
          aria-label={userHasReacted ? 'Remove heart' : 'Add heart'}
          title={userHasReacted ? 'Remove reaction' : 'React with ❤️'}
        >
          <span className="post-react-icon">{userHasReacted ? '❤️' : '🤍'}</span>
          <span className="post-react-count">{heartCount}</span>
        </button>

        {/* Comment toggle */}
        <button
          className="post-comment-btn"
          onClick={() => setShowComments(v => !v)}
          aria-expanded={showComments}
          aria-label="Toggle comments"
        >
          <span className="post-comment-icon">💬</span>
          <span className="post-comment-count">{commentCount}</span>
        </button>
      </div>

      {/* ── Comment thread (expandable) ── */}
      {showComments && (
        <CommentThread
          postId={post.id}
          currentUserId={currentUserId}
          onCountChange={setCommentCount}
        />
      )}
    </article>
  );
}