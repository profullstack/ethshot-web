-- Migration: Fix RLS Policies for Custom JWT Authentication
-- Created: 2025-01-27 11:28:00 UTC
-- Description: Updates RLS policies to work with custom JWT authentication system

-- The issue is that our RLS policies expect auth.uid() to return wallet addresses,
-- but we're using custom JWT tokens. We need to either:
-- 1. Disable RLS temporarily for server-side operations, or  
-- 2. Create a service role bypass, or
-- 3. Use a different approach

-- For now, let's create policies that allow server-side operations
-- by checking if the operation is coming from the service role

-- Drop existing restrictive policies on users table
DROP POLICY IF EXISTS "Users can view own data only" ON users;
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Create more permissive policies for server-side operations
-- These policies allow operations when using the service role key

-- Allow service role to perform all operations on users table
CREATE POLICY "Service role can manage users"
ON users
FOR ALL USING (
  auth.role() = 'service_role'
);

-- Allow authenticated users to view their own data (when we implement proper JWT parsing)
CREATE POLICY "Users can view own data"
ON users
FOR SELECT USING (
  auth.role() = 'service_role' OR 
  wallet_address = COALESCE(
    current_setting('request.jwt.claims', true)::json->>'walletAddress',
    current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow authenticated users to update their own data
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE USING (
  auth.role() = 'service_role' OR
  wallet_address = COALESCE(
    current_setting('request.jwt.claims', true)::json->>'walletAddress',
    current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Allow users to insert their own data (for registration)
CREATE POLICY "Users can insert own data"
ON users
FOR INSERT WITH CHECK (
  auth.role() = 'service_role' OR
  wallet_address = COALESCE(
    current_setting('request.jwt.claims', true)::json->>'walletAddress',
    current_setting('request.jwt.claims', true)::json->>'sub'
  )
);

-- Comments for documentation
COMMENT ON POLICY "Service role can manage users" ON users IS 'Allows server-side operations using service role key';
COMMENT ON POLICY "Users can view own data" ON users IS 'Users can view their own data using custom JWT claims';
COMMENT ON POLICY "Users can update own data" ON users IS 'Users can update their own data using custom JWT claims';
COMMENT ON POLICY "Users can insert own data" ON users IS 'Users can insert their own data during registration';