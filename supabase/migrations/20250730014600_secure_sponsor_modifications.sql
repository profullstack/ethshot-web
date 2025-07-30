-- Migration: Secure Sponsor Modifications
-- Created: 2025-01-30 01:46:00 UTC
-- Description: Restricts sponsor modifications to only the creator or admin users

-- Drop the overly permissive public update policy
DROP POLICY IF EXISTS "Allow public update on sponsors" ON sponsors;

-- Create a secure policy that only allows sponsor creators or admins to modify their records
CREATE POLICY "Secure sponsor modifications"
ON sponsors
FOR UPDATE USING (
  -- Allow if the user is the sponsor creator (wallet address matches)
  LOWER(sponsor_address) = LOWER(auth.jwt() ->> 'wallet_address')
  OR
  -- Allow if the user has admin privileges
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address') 
    AND is_admin = true
  )
);

-- Also secure DELETE operations (currently there's no delete policy)
CREATE POLICY "Secure sponsor deletions"
ON sponsors
FOR DELETE USING (
  -- Allow if the user is the sponsor creator (wallet address matches)
  LOWER(sponsor_address) = LOWER(auth.jwt() ->> 'wallet_address')
  OR
  -- Allow if the user has admin privileges
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address') 
    AND is_admin = true
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Secure sponsor modifications" ON sponsors IS 'Only allows sponsor creators or admin users to modify sponsor records';
COMMENT ON POLICY "Secure sponsor deletions" ON sponsors IS 'Only allows sponsor creators or admin users to delete sponsor records';