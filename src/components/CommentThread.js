// ============================================================
// src/components/CommentThread.js
// ─────────────────────────────────────────────────────────────
// Threaded comment system for a post.
// Top-level comments have parent_id = null.
// Replies have parent_id = top-level comment UUID.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CommentThread({ postId, currentUserId, onCountChange }) {
  const [comments,   setComments]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [replyText,  setReplyText]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  const commentInputRef = useRef(null);

  useEffect(() => {
    fetchComments();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchComments() {
    setLoading(true);

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

    const topLevel = (data || []).filter(c => !c.parent_id).map(c => ({
      ...c,
      replies: (data || []).filter(r => r.parent_id === c.id),
    }));

    setComments(topLevel);
    if (onCountChange) onCountChange(data?.length || 0);
    setLoading(false);
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);

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
      setComments(prev => [...prev, { ...data, replies: [] }]);
      if (onCountChange) onCountChange(c => c + 1);
    }

    setNewComment('');
    setSubmitting(false);
  }

  async function handleReplySubmit(e, parentId) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);

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
      if (onCountChange) onCountChange(c => c + 1);
    }

    setReplyText('');
    setReplyingTo(null);
    setSubmitting(false);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function getInitials(username = '') {
    return username.slice(0, 2).toUpperCase();
  }

  if (loading) {
    return <div className="comments-loading">Loading…</div>;
  }

  return (
    <div className="comment-thread">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="comments-empty">No comments yet. Be the first.</p>
      ) : (
        comments.map(comment => (
          <div key={comment.id} className="comment-block">
            {/* Top-level comment */}
            <div className="comment-row">
              <div className="comment-avatar">
                {getInitials(comment.author?.username)}
              </div>
              <div className="comment-body-wrap">
                <span className="comment-author">{comment.author?.username}</span>
                <p className="comment-body">{comment.body}</p>
                <div className="comment-meta">
                  <span className="comment-time">{formatTime(comment.created_at)}</span>
                  <button
                    className="comment-reply-btn"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>

            {/* Replies */}
            {comment.replies?.map(reply => (
              <div key={reply.id} className="comment-row comment-reply">
                <div className="comment-avatar comment-avatar-sm">
                  {getInitials(reply.author?.username)}
                </div>
                <div className="comment-body-wrap">
                  <span className="comment-author">{reply.author?.username}</span>
                  <p className="comment-body">{reply.body}</p>
                  <span className="comment-time">{formatTime(reply.created_at)}</span>
                </div>
              </div>
            ))}

            {/* Reply input */}
            {replyingTo === comment.id && (
              <form
                className="comment-reply-form"
                onSubmit={e => handleReplySubmit(e, comment.id)}
              >
                <input
                  className="comment-input"
                  placeholder="Write a reply…"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
                <button
                  type="submit"
                  className="comment-submit-btn"
                  disabled={submitting || !replyText.trim()}
                >
                  {submitting ? '…' : '↑'}
                </button>
              </form>
            )}
          </div>
        ))
      )}

      {/* New comment input */}
      <form className="comment-new-form" onSubmit={handleCommentSubmit}>
        <input
          ref={commentInputRef}
          className="comment-input"
          placeholder="Add a comment…"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          disabled={submitting}
        />
        <button
          type="submit"
          className="comment-submit-btn"
          disabled={submitting || !newComment.trim()}
        >
          {submitting ? '…' : '↑'}
        </button>
      </form>
    </div>
  );
}