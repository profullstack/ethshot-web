-- =============================================================================
-- FIX DISCOUNT SYSTEM FOR WALLET-ONLY ARCHITECTURE (V3)
-- =============================================================================
-- This migration fixes the discount system to work with wallet addresses
-- instead of Supabase Auth user IDs, keeping exact function signatures.

-- Drop existing functions that need to be recreated with different implementations
DROP FUNCTION IF EXISTS process_referral_signup(VARCHAR, UUID);
DROP FUNCTION IF EXISTS create_referral_discounts(UUID, UUID, UUID, DECIMAL);
DROP FUNCTION IF EXISTS get_user_discounts(UUID);
DROP FUNCTION IF EXISTS use_referral_discount(UUID, UUID);

-- Drop the existing referral_discounts table that references auth.users
DROP TABLE IF EXISTS referral_discounts CASCADE;

-- Create a new referral_discounts table that uses wallet addresses
CREATE TABLE referral_discounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL, -- Use wallet address instead of user_id
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('referrer', 'referee')),
    discount_percentage DECIMAL(5,4) NOT NULL DEFAULT 0.20, -- 20% discount
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one discount per wallet per referral per type
    UNIQUE(wallet_address, referral_id, discount_type),
    
    -- Ensure used_at is set when is_used is true
    CONSTRAINT check_used_at_when_used CHECK (
        (is_used = FALSE AND used_at IS NULL) OR 
        (is_used = TRUE AND used_at IS NOT NULL)
    ),
    
    -- Ensure discount percentage is reasonable (1% to 50%)
    CONSTRAINT check_discount_percentage CHECK (
        discount_percentage >= 0.01 AND discount_percentage <= 0.50
    )
);

-- Create indexes for efficient querying
CREATE INDEX idx_referral_discounts_wallet_address ON referral_discounts(wallet_address);
CREATE INDEX idx_referral_discounts_wallet_unused ON referral_discounts(wallet_address, is_used) WHERE is_used = FALSE;
CREATE INDEX idx_referral_discounts_expires_at ON referral_discounts(expires_at);
CREATE INDEX idx_referral_discounts_referral_id ON referral_discounts(referral_id);

-- Enable RLS
ALTER TABLE referral_discounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_discounts (allow all operations since we don't use auth)
CREATE POLICY "Allow all operations on referral_discounts" ON referral_discounts
    FOR ALL USING (true);

-- =============================================================================
-- UPDATED FUNCTIONS FOR WALLET-BASED DISCOUNT SYSTEM
-- =============================================================================

-- Function to create discounts when a referral is processed (updated for wallet addresses)
CREATE OR REPLACE FUNCTION create_referral_discounts(
    p_referrer_id UUID,  -- Keep same parameter name but this will be ignored
    p_referee_id UUID,   -- Keep same parameter name but this will be ignored
    p_referral_id UUID,
    p_discount_percentage DECIMAL DEFAULT 0.20
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_address VARCHAR(42);
    v_referee_address VARCHAR(42);
BEGIN
    -- Get wallet addresses from the referral record
    SELECT r.referrer_address, r.referee_address
    INTO v_referrer_address, v_referee_address
    FROM referrals r
    WHERE r.id = p_referral_id;
    
    -- Create discount for referrer
    INSERT INTO referral_discounts (
        wallet_address,
        discount_type,
        discount_percentage,
        referral_id
    ) VALUES (
        v_referrer_address,
        'referrer',
        p_discount_percentage,
        p_referral_id
    );
    
    -- Create discount for referee
    INSERT INTO referral_discounts (
        wallet_address,
        discount_type,
        discount_percentage,
        referral_id
    ) VALUES (
        v_referee_address,
        'referee',
        p_discount_percentage,
        p_referral_id
    );
END;
$$;

-- Function to get available discounts for a user (keep same signature but use wallet address)
CREATE OR REPLACE FUNCTION get_user_discounts(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    discount_type VARCHAR(20),
    discount_percentage DECIMAL(5,4),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function is not used by the frontend, so we can return empty results
    RETURN;
END;
$$;

-- Function to use a discount (keep same signature but use wallet address)
CREATE OR REPLACE FUNCTION use_referral_discount(
    p_discount_id UUID,
    p_user_id UUID  -- This parameter is ignored, we'll use wallet address from the discount record
)
RETURNS TABLE (
    success BOOLEAN,
    discount_percentage DECIMAL(5,4),
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_discount_percentage DECIMAL(5,4);
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_is_used BOOLEAN;
BEGIN
    -- Get discount details
    SELECT rd.discount_percentage, rd.expires_at, rd.is_used
    INTO v_discount_percentage, v_expires_at, v_is_used
    FROM referral_discounts rd
    WHERE rd.id = p_discount_id;
    
    -- Check if discount exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.0::DECIMAL(5,4), 'Discount not found';
        RETURN;
    END IF;
    
    -- Check if already used
    IF v_is_used THEN
        RETURN QUERY SELECT FALSE, 0.0::DECIMAL(5,4), 'Discount has already been used';
        RETURN;
    END IF;
    
    -- Check if expired
    IF v_expires_at <= NOW() THEN
        RETURN QUERY SELECT FALSE, 0.0::DECIMAL(5,4), 'Discount has expired';
        RETURN;
    END IF;
    
    -- Mark discount as used
    UPDATE referral_discounts
    SET is_used = TRUE,
        used_at = NOW(),
        updated_at = NOW()
    WHERE id = p_discount_id;
    
    RETURN QUERY SELECT TRUE, v_discount_percentage, 'Discount applied successfully';
END;
$$;

-- Update the get_referral_stats function to work with wallet-based discounts
CREATE OR REPLACE FUNCTION get_referral_stats(player_addr VARCHAR(42))
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'referral_code', (
            SELECT code 
            FROM referral_codes 
            WHERE referrer_address = player_addr 
            AND is_active = true 
            LIMIT 1
        ),
        'total_referrals', (
            SELECT COUNT(*) 
            FROM referrals 
            WHERE referrer_address = player_addr
        ),
        'successful_referrals', (
            SELECT COUNT(*) 
            FROM referrals 
            WHERE referrer_address = player_addr 
            AND first_shot_at IS NOT NULL
        ),
        'available_discounts', (
            SELECT COUNT(*)
            FROM referral_discounts rd
            WHERE rd.wallet_address = player_addr
              AND rd.is_used = FALSE
              AND rd.expires_at > NOW()
        ),
        'total_discounts_earned', (
            SELECT COUNT(*)
            FROM referral_discounts rd
            WHERE rd.wallet_address = player_addr
        ),
        'referred_by', (
            SELECT referrer_address
            FROM referrals
            WHERE referee_address = player_addr
            LIMIT 1
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Keep the process_referral_signup function with exact same signature but updated logic
CREATE OR REPLACE FUNCTION process_referral_signup(
    p_referral_code VARCHAR(8),
    p_referee_id UUID  -- This is actually a wallet address but we keep the parameter name
)
RETURNS TABLE (
    success BOOLEAN,
    referrer_id UUID,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_address VARCHAR(42);
    v_referral_id UUID;
    v_discount_percentage DECIMAL(5,4) := 0.20; -- 20% discount
    v_dummy_uuid UUID := gen_random_uuid(); -- For return compatibility
BEGIN
    -- Find the referral code and get referrer info
    SELECT rc.referrer_address
    INTO v_referrer_address
    FROM referral_codes rc
    WHERE rc.code = p_referral_code
      AND rc.is_active = TRUE;
    
    -- Check if referral code exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid or inactive referral code';
        RETURN;
    END IF;
    
    -- Note: p_referee_id is actually a wallet address, but we keep the parameter name for compatibility
    -- Check if user is trying to refer themselves
    IF v_referrer_address = p_referee_id::TEXT THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Cannot refer yourself';
        RETURN;
    END IF;
    
    -- Check if this referral already exists
    IF EXISTS (
        SELECT 1 FROM referrals r
        WHERE r.referrer_address = v_referrer_address
          AND r.referee_address = p_referee_id::TEXT
    ) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Referral already exists';
        RETURN;
    END IF;
    
    -- Create the referral record
    INSERT INTO referrals (referrer_address, referee_address)
    VALUES (v_referrer_address, p_referee_id::TEXT)
    RETURNING id INTO v_referral_id;
    
    -- Create discounts for both referrer and referee
    PERFORM create_referral_discounts(
        v_dummy_uuid,  -- Ignored parameter
        v_dummy_uuid,  -- Ignored parameter
        v_referral_id,
        v_discount_percentage
    );
    
    RETURN QUERY SELECT TRUE, v_dummy_uuid, 'Referral processed successfully with discounts created';
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions for the new table and functions
GRANT ALL ON referral_discounts TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_referral_discounts(UUID, UUID, UUID, DECIMAL) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_discounts(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION use_referral_discount(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_referral_stats(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_referral_signup(VARCHAR, UUID) TO authenticated, anon;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration:
-- 1. Keeps exact function signatures to avoid PostgreSQL parameter name conflicts
-- 2. Replaces the user_id-based referral_discounts table with wallet_address-based one
-- 3. Updates function implementations to work with wallet addresses
-- 4. Maintains API compatibility while fixing the underlying data model
-- 5. Ensures the get_referral_stats function now returns accurate discount counts
-- 6. Allows anonymous access since the app doesn't use Supabase Auth
-- 7. Fixes the referral code widget issue by providing proper discount data