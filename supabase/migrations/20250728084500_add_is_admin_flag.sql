-- Add is_admin flag to user_profiles table
-- This allows database-level admin control instead of relying on contract ownership

-- Add is_admin column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.is_admin IS 'Flag to indicate if user has admin privileges for test mode and other admin functions';

-- Create index for efficient admin queries
CREATE INDEX idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = TRUE;

-- Update RLS policies to allow admins to see admin-specific data
-- (This is a placeholder - specific admin policies can be added as needed)

-- Grant necessary permissions
-- Note: Specific permissions will be handled by existing RLS policies