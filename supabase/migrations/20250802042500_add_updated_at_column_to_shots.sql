-- Add updated_at column to shots table
-- 
-- This migration adds the missing updated_at column to the shots table
-- and sets up a trigger to automatically update it when rows are modified.

-- Add the updated_at column to the shots table
ALTER TABLE shots ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_shots_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column on row updates
DROP TRIGGER IF EXISTS update_shots_updated_at ON shots;
CREATE TRIGGER update_shots_updated_at 
    BEFORE UPDATE ON shots 
    FOR EACH ROW 
    EXECUTE FUNCTION update_shots_updated_at_column();

-- Add a comment to document the column
COMMENT ON COLUMN shots.updated_at IS 'Timestamp of when the shot record was last updated';

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Added updated_at column to shots table successfully';
END $$;