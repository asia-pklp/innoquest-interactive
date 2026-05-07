-- Migration: Add game_type and game_name columns to game_settings
-- Run this in Supabase SQL Editor before deploying the multi-game update

ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'startup_simulation',
  ADD COLUMN IF NOT EXISTS game_name TEXT NOT NULL DEFAULT 'InnoQuest Game';

-- Backfill the existing default game
UPDATE game_settings
SET
  game_type = 'startup_simulation',
  game_name = 'InnoQuest Game'
WHERE game_id = '00000000-0000-0000-0000-000000000001';
