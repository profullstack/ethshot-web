-- Fix set_config function by using a different name to avoid conflicts
-- Drop the previous function and create a new one with a unique name

DROP FUNCTION IF EXISTS set_config(text, text, boolean);

-- Create a new function with a unique name
CREATE OR REPLACE FUNCTION set_user_config(
  setting_name text,
  setting_value text,
  is_local boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use the built-in PostgreSQL set_config function
  PERFORM set_config(setting_name, setting_value, is_local);
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION set_user_config(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_config(text, text, boolean) TO anon;

-- Also create an alias with the original name for backward compatibility
CREATE OR REPLACE FUNCTION set_config(
  setting_name text,
  setting_value text,
  is_local boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call our renamed function
  PERFORM set_user_config(setting_name, setting_value, is_local);
END;
$$;

-- Grant execute permission for the alias function
GRANT EXECUTE ON FUNCTION set_config(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_config(text, text, boolean) TO anon;