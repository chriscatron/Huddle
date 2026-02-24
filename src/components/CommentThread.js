// ============================================================
// src/components/CommentThread.js
// ─────────────────────────────────────────────────────────────
// Threaded comment system for a post.
// Top-level comments have parent_id = null.
// Replies have parent_id = top-level comment UUID.
// One level of nesting (reply to reply not supported in v1).
// ─────────────────────────────────────────────────────────────
// Props:
//   postId        {string}    UUID of the parent post
//   currentUserId {string}    logged-in user's UUID
//   onCountChange {function}  called with new total count when comments change
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─────────────────────────────────────────
// Mock comments for development
// Replace with real Supabase fetch when connected
// ─────────────────────────────────────────
const MOCK_COMMENTS = [
  {
    id:        'c1',
    post_id:   'mock-post',
    author_id: 'user-debbie',
    parent_id: null,
    body:      'This is such a beautiful reflection 💜',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    author:    { username: 'Debbie', avatar_url: null },
    replies:   [
      {
        id:        'c2',
        post_id:   'mock-post',
        author_id: 'user-ashley',
        parent_id: 'c1',
        body:      'I felt this so much.',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        author:    { username: 'Ashley', avatar_url: null },
      }
    ],
  },
  {
    id:        'c3',
    post_id:   'mock-post',
    author_id: 'user-megan',
    parent_id: null,
    body:      'Thank you for sharing this with us 🙏',
    created_at: new Date(Date.now() - 900000).toISOString(),
    author:    { username: 'Megan', avatar_url: null },
    replies:   [],
  },
];

export default function CommentThread({ postId, currentUserId, onCountChange }) {
  const [comments,    setComments]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [replyingTo,  setReplyingTo]  = useState(null);  // comment id or null
  const [newComment,  setNewComment]  = useState('');
  const [replyText,   setReplyText]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const commentInputRef = useRef(null);

  // ─────────────────────────────────────────
  // Load comments on mount
  // ─────────────────────────────────────────
  useEffect(() => {
    fetchComments();
  }, [postId]);

  async function fetchComments() {
    setLoading(true);

    // ── Real Supabase fetch ───────────────
    // Uncomment when connected:
    /*
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles(username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Huddle] Comments fetch error:', error.message);
      setLoading(false);
      return;
    }

    // Build threaded structure: top-level + their replies
    const topLevel = data.filter(c => !c.parent_id).map(c => ({
      ...c,
      replies: data.filter(r => r.parent_id === c.id),
    }));

    setComments(topLevel);
    if (onCountChange) onCountChange(data.length);
    */
    // ── END real fetch ────────────────────

    // ── MOCK ─────────────────────────────
    setComments(MOCK_COMMENTS);
    if (onCountChange) onCountChange(3);
    // ── END mock ─────────────────────────

    setLoading(false);
  }

  // ─────────────────────────────────────────
  // Submit a new top-level comment
  // ─────────────────────────────────────────
  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);

    // ── Real Supabase insert ──────────────
    // Uncomment when connected:
    /*
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id:   postId,
        author_id: currentUserId,
        parent_id: null,
        body:      newComment.trim(),
      })
      .select('*, author:profiles(username, avatar_url)')
      .single();

    if (!error) {
      const newThread = { ...data, replies: [] };
      setComments(prev => [...prev, newThread]);
      if (onCountChange) onCountChange(prev => prev + 1);
    }
    */
    // ── END real insert ───────────────────

    // ── MOCK ─────────────────────────────
    const mock = {
      id:         `c-${Date.now()}`,
      post_id:    postId,
      author_id:  currentUserId,
      parent_id:  null,
      body:       newComment.trim(),
      created_at: new Date().toISOString(),
      author:     { username: 'You', avatar_url: null },
      replies:    [],
    };
    setComments(prev => [...prev, mock]);
    if (onCountChange) onCountChange(c => c + 1);
    // ── END mock ─────────────────────────

    setNewComment('');
    setSubmitting(false);
  }

  // ─────────────────────────────────────────
  // Submit a reply to a comment
  // ─────────────────────────────────────────
  async function handleReplySubmit(e, parentId) {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSubmitting(true);

    // ── Real Supabase insert ──────────────
    // Uncomment when connected:
    /*
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id:   postId,
        author_id: currentUserId,
        parent_id: parentId,
        body:      replyText.trim(),
      })
      .select('*, author:profiles(username, avatar_url)')
      .single();

    if (!error) {
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies: [...c.replies, data] } : c
      ));
      if (onCountChange) onCountChange(prev => prev + 1);
    }
    */
    // ── END real insert ───────────────────

    // ── MOCK ─────────────────────────────
    const mockReply = {
      id:         `r-${Date.now()}`,
      post_id:    postId,
      author_id:  currentUserId,
      parent_id:  parentId,
      body:       replyText.trim(),
      created_at: new Date().toISOString(),
      author:     { username: 'You', avatar_url: null },
    };
    setComments(prev => prev.map(c =>
      c.id === parentId ? { ...c, replies: [...c.replies, mockReply] } : c
    ));
    if (onCountChange) onCountChange(c => c + 1);
    // ── END mock ─────────────────────────

    setReplyText('');
    setReplyingTo(null);
    setSubmitting(false);
  }

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────
  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function getInitials(username = '') {
    return username.slice(0, 2).toUpperCase() || '?';
  }

  // ─────────────────────────────────────────
  // Render a single comment row (used for both top-level + replies)
  // ─────────────────────────────────────────
  function CommentRow({ comment, isReply = false }) {
    return (
      <div className={`comment-row ${isReply ? 'comment-reply' : ''}`}>
        {/* Avatar */}
        <div className="comment-avatar">
          {comment.author?.avatar_url
            ? <img src={comment.author.avatar_url} alt={comment.author.username} />
            : <span>{getInitials(comment.author?.username)}</span>
          }
        </div>

        <div className="comment-content">
          <div className="comment-meta">
            <span className="comment-author">{comment.author?.username || 'Member'}</span>
            <span className="comment-time">{formatTime(comment.created_at)}</span>
          </div>
          <p className="comment-body">{comment.body}</p>

          {/* Reply button — only on top-level comments */}
          {!isReply && (
            <button
              className="comment-reply-btn"
              onClick={() => {
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyText('');
              }}
            >
              {replyingTo === comment.id ? 'Cancel' : 'Reply'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  if (loading) {
    return <div className="comment-loading">Loading comments…</div>;
  }

  return (
    <div className="comment-thread">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="comment-empty">No comments yet. Be the first to respond.</p>
      ) : (
        comments.map(comment => (
          <div key={comment.id} className="comment-group">
            <CommentRow comment={comment} />

            {/* Replies */}
            {comment.replies?.map(reply => (
              <CommentRow key={reply.id} comment={reply} isReply />
            ))}

            {/* Reply input — shown when this comment is being replied to */}
            {replyingTo === comment.id && (
              <form
                className="comment-reply-form"
                onSubmit={e => handleReplySubmit(e, comment.id)}
              >
                <input
                  autoFocus
                  className="comment-reply-input"
                  placeholder={`Reply to ${comment.author?.username}…`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  disabled={submitting}
                  maxLength={500}
                />
                <button
                  type="submit"
                  className="comment-reply-send"
                  disabled={!replyText.trim() || submitting}
                >
                  Send
                </button>
              </form>
            )}
          </div>
        ))
      )}

      {/* New top-level comment input */}
      <form className="comment-new-form" onSubmit={handleCommentSubmit}>
        <input
          ref={commentInputRef}
          className="comment-new-input"
          placeholder="Write a comment…"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          disabled={submitting}
          maxLength={500}
        />
        <button
          type="submit"
          className="comment-new-send"
          disabled={!newComment.trim() || submitting}
        >
          Send
        </button>
      </form>
    </div>
  );
}