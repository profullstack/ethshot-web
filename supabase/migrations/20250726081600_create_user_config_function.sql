-- Create user configuration function without conflicting with PostgreSQL built-ins
-- We'll use a completely different name to avoid any conflicts

-- Create the main function for setting user configuration
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

-- Create a wrapper function that the client can call
-- This avoids any naming conflicts with the built-in set_config
CREATE OR REPLACE FUNCTION rpc_set_config(
  setting_name text,
  setting_value text,
  is_local boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call our user config function
  PERFORM set_user_config(setting_name, setting_value, is_local);
END;
$$;

-- Grant execute permission for the RPC wrapper
GRANT EXECUTE ON FUNCTION rpc_set_config(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_set_config(text, text, boolean) TO anon;