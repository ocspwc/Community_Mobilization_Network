-- Supabase Setup SQL for Community Mobilization Network
-- Run this in Supabase Dashboard -> SQL Editor

-- Create table to store organization overlay state (status, notes, note_history)
CREATE TABLE IF NOT EXISTS organization_overlays (
  id INTEGER PRIMARY KEY DEFAULT 1,
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Create index on JSONB for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_state_data ON organization_overlays USING GIN (state_data);

-- Insert initial empty state record
INSERT INTO organization_overlays (id, state_data)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE organization_overlays ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations" ON organization_overlays;

-- Create policy to allow all operations for both authenticated and anon users
CREATE POLICY "Allow all operations" ON organization_overlays
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON organization_overlays TO authenticated;
GRANT ALL ON organization_overlays TO anon;
