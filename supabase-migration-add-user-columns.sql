-- Migration: Add missing columns to app_users table
-- Execute this in Supabase SQL Editor
-- This adds the columns that exist in shared/schema.ts but are missing in Supabase

-- Step 1: Add missing columns to app_users
ALTER TABLE app_users 
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Step 2: Migrate existing data from profile jsonb to new columns
-- This ensures existing users will have their names visible in the UI
UPDATE app_users
SET 
  first_name = COALESCE(first_name, profile->>'firstName'),
  last_name = COALESCE(last_name, profile->>'lastName'),
  gender = COALESCE(gender, profile->>'gender'),
  position = COALESCE(position, profile->>'position'),
  avatar_url = COALESCE(avatar_url, profile->>'avatarUrl')
WHERE profile IS NOT NULL AND profile::text != '{}';
