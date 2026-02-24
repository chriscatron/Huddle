// ============================================================
// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────
// Single Supabase client instance shared across the whole app.
// Import { supabase } from '../lib/supabaseClient' anywhere you
// need to query the database or call auth methods.
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────
// Environment variables
// In Create React App these must be prefixed with REACT_APP_
// Create a .env file at your project root:
//
//   REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
//   REACT_APP_SUPABASE_ANON_KEY=eyJ...
//
// NEVER commit your .env file. Add it to .gitignore.
// ─────────────────────────────────────────
const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    '[Huddle] Missing Supabase env vars. ' +
    'Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.'
  );
}

// ─────────────────────────────────────────
// Create and export the single client instance
// ─────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    // Persist session in localStorage so users stay logged in across page refreshes
    persistSession: true,
    // Automatically refresh the JWT before it expires
    autoRefreshToken: true,
    // Detect the magic link token in the URL on redirect
    detectSessionInUrl: true,
  },
});

// ─────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────

/**
 * Send a magic link to the user's email.
 * Supabase emails a one-time link; clicking it logs them in.
 *
 * @param {string} email
 * @param {string} redirectTo - URL Supabase redirects to after click (your app)
 * @returns {Promise<{ error }>}
 */
export async function sendMagicLink(email, redirectTo = window.location.origin) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return { error };
}

/**
 * Sign the current user out.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[Huddle] Sign out error:', error.message);
}

/**
 * Get the currently authenticated user (sync from local session).
 * Returns null if not logged in.
 */
export function getCurrentUser() {
  return supabase.auth.getUser();
}