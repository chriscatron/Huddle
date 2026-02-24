-- ============================================================
-- HUDDLE — Supabase Schema + RLS Policies
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────
-- 1. PROFILES
-- One row per user. Created automatically on signup.
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- 2. HUDDLES
-- Each huddle has one founder, one active word, and an invite token.
-- ─────────────────────────────────────────
CREATE TABLE huddles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  founder_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invite_token  TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. HUDDLE WORDS
-- A huddle can have many words over time (monthly rotation).
-- Only one is active at a time (is_active = true).
-- ─────────────────────────────────────────
CREATE TABLE huddle_words (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id   UUID REFERENCES huddles(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,                        -- e.g. "GRACE"
  -- letter_meanings is a JSON object: { "G": "Grateful", "R": "Rant", ... }
  letter_meanings JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN DEFAULT FALSE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one active word per huddle at a time
CREATE UNIQUE INDEX one_active_word_per_huddle
  ON huddle_words (huddle_id)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────
-- 4. HUDDLE MEMBERS
-- Join table: which users belong to which huddle.
-- ─────────────────────────────────────────
CREATE TABLE huddle_members (
  huddle_id   UUID REFERENCES huddles(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (huddle_id, user_id)
);

-- ─────────────────────────────────────────
-- 5. POSTS
-- A post belongs to a huddle, written by a user.
-- letters is an array e.g. ["G", "A"] for multi-tag.
-- word_snapshot captures the word at time of posting (persists after word changes).
-- ─────────────────────────────────────────
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id       UUID REFERENCES huddles(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  letters         TEXT[] NOT NULL DEFAULT '{}',     -- e.g. ARRAY['G','A']
  word_snapshot   TEXT NOT NULL,                    -- e.g. "GRACE"
  -- meanings_snapshot captures letter meanings at time of post
  meanings_snapshot JSONB NOT NULL DEFAULT '{}',
  photo_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 6. REACTIONS
-- One reaction type (heart) per user per post for now.
-- Extend reaction_type for more emoji later.
-- ─────────────────────────────────────────
CREATE TABLE reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id, reaction_type)          -- one heart per user per post
);

-- ─────────────────────────────────────────
-- 7. COMMENTS
-- Threaded: parent_id is NULL for top-level, set for replies.
-- ─────────────────────────────────────────
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE, -- NULL = top-level
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddle_words   ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- PROFILES policies
-- ─────────────────────────────────────────
-- Anyone can read profiles (needed for displaying names in feed)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (TRUE);

-- Users can only update their own profile
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─────────────────────────────────────────
-- HUDDLES policies
-- ─────────────────────────────────────────
-- Members can see their huddle
CREATE POLICY "huddles_select" ON huddles
  FOR SELECT USING (
    id IN (
      SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can create a huddle (founder)
CREATE POLICY "huddles_insert" ON huddles
  FOR INSERT WITH CHECK (auth.uid() = founder_id);

-- Only founder can update huddle settings
CREATE POLICY "huddles_update" ON huddles
  FOR UPDATE USING (auth.uid() = founder_id);

-- ─────────────────────────────────────────
-- HUDDLE_WORDS policies
-- ─────────────────────────────────────────
-- Members of the huddle can see its words
CREATE POLICY "huddle_words_select" ON huddle_words
  FOR SELECT USING (
    huddle_id IN (
      SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
    )
  );

-- Only the huddle founder can set words
CREATE POLICY "huddle_words_insert" ON huddle_words
  FOR INSERT WITH CHECK (
    huddle_id IN (
      SELECT id FROM huddles WHERE founder_id = auth.uid()
    )
  );

CREATE POLICY "huddle_words_update" ON huddle_words
  FOR UPDATE USING (
    huddle_id IN (
      SELECT id FROM huddles WHERE founder_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- HUDDLE_MEMBERS policies
-- ─────────────────────────────────────────
-- Members can see who else is in their huddle
CREATE POLICY "huddle_members_select" ON huddle_members
  FOR SELECT USING (
    huddle_id IN (
      SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
    )
  );

-- Anyone authenticated can join via invite (checked in app logic with token)
CREATE POLICY "huddle_members_insert" ON huddle_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can leave (delete their own membership)
CREATE POLICY "huddle_members_delete" ON huddle_members
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- POSTS policies
-- ─────────────────────────────────────────
-- Members can read all posts in their huddle
CREATE POLICY "posts_select" ON posts
  FOR SELECT USING (
    huddle_id IN (
      SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
    )
  );

-- Members can create posts in their huddle
CREATE POLICY "posts_insert" ON posts
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    huddle_id IN (
      SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
    )
  );

-- Authors can update/delete their own posts
CREATE POLICY "posts_update" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "posts_delete" ON posts
  FOR DELETE USING (auth.uid() = author_id);

-- ─────────────────────────────────────────
-- REACTIONS policies
-- ─────────────────────────────────────────
-- Members can see all reactions on posts in their huddle
CREATE POLICY "reactions_select" ON reactions
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM posts WHERE huddle_id IN (
        SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
      )
    )
  );

-- Members can add reactions
CREATE POLICY "reactions_insert" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "reactions_delete" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- COMMENTS policies
-- ─────────────────────────────────────────
-- Members can read comments on posts in their huddle
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM posts WHERE huddle_id IN (
        SELECT huddle_id FROM huddle_members WHERE user_id = auth.uid()
      )
    )
  );

-- Members can post comments
CREATE POLICY "comments_insert" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own comments
CREATE POLICY "comments_delete" ON comments
  FOR DELETE USING (auth.uid() = author_id);

-- ============================================================
-- SAMPLE SEED DATA (for development — remove before production)
-- ============================================================

-- NOTE: You cannot seed auth.users directly from SQL editor.
-- Create two test users manually in Supabase Auth > Users,
-- then replace the UUIDs below with their actual IDs.

-- INSERT INTO huddles (id, name, founder_id) VALUES
--   ('11111111-1111-1111-1111-111111111111', 'Grace Girls', '<your-user-uuid>');

-- INSERT INTO huddle_words (huddle_id, word, letter_meanings, is_active) VALUES
--   ('11111111-1111-1111-1111-111111111111', 'GRACE', 
--    '{"G":"Grateful","R":"Rant","A":"Aha","C":"Challenge","E":"Educate"}', 
--    TRUE);