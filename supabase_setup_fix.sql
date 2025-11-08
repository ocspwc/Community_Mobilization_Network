-- Fix for existing table without state_data column
-- Run this in Supabase Dashboard -> SQL Editor

-- Step 1: Drop the table if it exists (safe because we'll recreate it)
DROP TABLE IF EXISTS organization_overlays CASCADE;

-- Step 2: Create the table with the correct schema
CREATE TABLE organization_overlays (
  id INTEGER PRIMARY KEY DEFAULT 1,
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Step 3: Create index on JSONB for better query performance
CREATE INDEX idx_state_data ON organization_overlays USING GIN (state_data);

-- Step 4: Insert initial empty state record
INSERT INTO organization_overlays (id, state_data)
VALUES (1, '{}'::jsonb);

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE organization_overlays ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policy to allow all operations
CREATE POLICY "Allow all operations" ON organization_overlays
FOR ALL
USING (true)
WITH CHECK (true);

-- Step 7: Grant necessary permissions
GRANT ALL ON organization_overlays TO authenticated;
GRANT ALL ON organization_overlays TO anon;

