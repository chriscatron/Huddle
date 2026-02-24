// ============================================================
// src/App.js
// ─────────────────────────────────────────────────────────────
// Root component. Handles:
//   • Auth state (logged in / logged out)
//   • Invite token detection in the URL (?invite=TOKEN)
//   • Route switching between LoginPage and HuddlePage
//
// DEV MODE: Session is mocked to bypass login screen.
// When ready to deploy, replace the two lines marked
// DEV MODE below with the two lines marked PRODUCTION.
// ============================================================

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

import LoginPage  from './pages/LoginPage';
import HuddlePage from './pages/HuddlePage';

import './App.css';

// ─────────────────────────────────────────
// App shell — manages session state
// ─────────────────────────────────────────
export default function App() {
  // DEV MODE — bypasses login, goes straight to HuddlePage
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // PRODUCTION — uncomment these two lines and remove the two DEV MODE lines above
  // const [session, setSession] = useState(undefined);
  // const [loading, setLoading] = useState(true);

  useEffect(() => {
    //PRODUCTION — uncomment this entire block when deploying
    //*
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
   
  }, []);

  // Show nothing while we check session (avoids flicker)
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Login route — redirect to huddle if already logged in */}
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Invite route — join a huddle via token, then redirect */}
        <Route
          path="/invite/:token"
          element={
            session
              ? <InviteHandler session={session} />
              : <Navigate to="/login" replace />
          }
        />

        {/* Main app route — requires auth */}
        <Route
          path="/"
          element={
            session
              ? <HuddlePage session={session} />
              : <Navigate to="/login" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ─────────────────────────────────────────
// InviteHandler
// Processes an invite token from the URL,
// adds the user to the huddle, then redirects home.
// ─────────────────────────────────────────
function InviteHandler({ session }) {
  // react-router-dom v6 way to get URL params
  const { token } = useParams();
  const navigate  = useNavigate();
  const [status, setStatus] = useState('Joining huddle…');

  useEffect(() => {
    async function joinHuddle() {
      // 1. Look up the huddle by invite token
      const { data: huddle, error: findError } = await supabase
        .from('huddles')
        .select('id, name')
        .eq('invite_token', token)
        .single();

      if (findError || !huddle) {
        setStatus('Invalid invite link.');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      // 2. Insert membership row (RLS allows this if user is authenticated)
      const { error: joinError } = await supabase
        .from('huddle_members')
        .insert({ huddle_id: huddle.id, user_id: session.user.id })
        .select()
        .single();

      // Ignore duplicate key error — user is already a member
      if (joinError && !joinError.message.includes('duplicate')) {
        setStatus('Could not join. Please try again.');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      setStatus(`Welcome to ${huddle.name}!`);
      setTimeout(() => navigate('/'), 1500);
    }

    joinHuddle();
  }, [token, session, navigate]);

  return (
    <div className="app-loading">
      <p className="loading-text">{status}</p>
    </div>
  );
}