-- Migration: Price War game support
-- Run in Supabase SQL Editor after add_game_type_columns.sql

-- 1. Add game_config JSONB column to game_settings (stores game-type-specific params)
ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS game_config JSONB;

-- 2. Create price_war_results table
--    Each row = one team's submission + calculated result for one round.
--    Populated in two phases:
--      Phase 1 (team submits price): price_set, units_available, submitted_at filled
--      Phase 2 (admin advances round): units_sold, revenue, profit, cumulative_profit filled
CREATE TABLE IF NOT EXISTS price_war_results (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id           UUID NOT NULL,
  team_id           UUID NOT NULL,
  round_number      INT  NOT NULL,
  price_set         DECIMAL(12, 2) NOT NULL,
  units_available   INT  NOT NULL,
  units_sold        INT,                    -- NULL until round is calculated
  revenue           DECIMAL(12, 2),         -- NULL until calculated
  profit            DECIMAL(12, 2),         -- NULL until calculated
  cumulative_profit DECIMAL(12, 2),         -- NULL until calculated
  submitted_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  calculated_at     TIMESTAMP WITH TIME ZONE,
  UNIQUE (game_id, team_id, round_number)
);

-- Enable realtime on price_war_results
ALTER PUBLICATION supabase_realtime ADD TABLE price_war_results;
