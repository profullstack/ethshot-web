-- Migration: Add sponsor URL field to sponsors table
-- Created: 2025-01-23 12:26:19 UTC
-- Description: Adds a sponsor_url field to the sponsors table to allow sponsors to include their website URL for traffic incentives

-- Add sponsor_url column to sponsors table
ALTER TABLE sponsors 
ADD COLUMN sponsor_url TEXT;

-- Add index for sponsor_url for better performance when filtering by URL
CREATE INDEX IF NOT EXISTS idx_sponsors_sponsor_url ON sponsors(sponsor_url);

-- Add comment for documentation
COMMENT ON COLUMN sponsors.sponsor_url IS 'Website URL of the sponsor for traffic incentives';

-- Update existing sponsors with NULL sponsor_url (they can be updated later)
-- No data migration needed as this is a new optional field