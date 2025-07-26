-- Add set_config RPC function for client-side use
-- This allows the frontend to set configuration values for RLS policies

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
  -- Use the built-in PostgreSQL set_config function
  PERFORM set_config(setting_name, setting_value, is_local);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_config(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_config(text, text, boolean) TO anon;