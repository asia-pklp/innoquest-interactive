-- Reusable scenario templates (not tied to a specific game)
-- Run once to create the table in Supabase

CREATE TABLE IF NOT EXISTS scenario_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  param_overrides JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow read/write from the client (adjust RLS as needed)
ALTER TABLE scenario_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenario_templates_all" ON scenario_templates
  FOR ALL USING (true) WITH CHECK (true);
