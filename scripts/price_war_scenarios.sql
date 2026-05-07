-- Migration: Price War Scenarios / Event Queue
-- Run in Supabase SQL Editor after price_war_schema.sql

-- Each row is an event/scenario that fires when a specific round begins.
-- param_overrides is a JSONB patch applied on top of game_config when the round starts.
-- Example: {"total_customers": 15, "fixed_cost": 1500}
CREATE TABLE IF NOT EXISTS price_war_scenarios (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id         UUID NOT NULL,
  round_number    INT  NOT NULL,          -- fires when THIS round starts
  title           TEXT NOT NULL,          -- short headline shown on projector/student card
  description     TEXT,                   -- narrative paragraph for students
  param_overrides JSONB NOT NULL DEFAULT '{}', -- fields to merge into game_config
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (game_id, round_number)
);

-- Enable realtime so scenario changes propagate immediately
ALTER PUBLICATION supabase_realtime ADD TABLE price_war_scenarios;
