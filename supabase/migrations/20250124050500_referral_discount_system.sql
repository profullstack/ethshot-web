-- =============================================================================
-- REFERRAL DISCOUNT SYSTEM MIGRATION
-- =============================================================================
-- This migration transitions from the bonus shots system to a discount system
-- for referral rewards, ensuring economic sustainability while maintaining
-- viral growth incentives.

-- Drop the bonus_shots table as we're replacing it with discounts
DROP TABLE IF EXISTS bonus_shots CASCADE;

-- Create referral_discounts table to track discount availability and usage
CREATE TABLE referral_discounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('referrer', 'referee')),
    discount_percentage DECIMAL(5,4) NOT NULL DEFAULT 0.20, -- 20% discount
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one discount per user per referral per type
    UNIQUE(user_id, referral_id, discount_type),
    
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
CREATE INDEX idx_referral_discounts_user_id ON referral_discounts(user_id);
CREATE INDEX idx_referral_discounts_user_unused ON referral_discounts(user_id, is_used) WHERE is_used = FALSE;
CREATE INDEX idx_referral_discounts_expires_at ON referral_discounts(expires_at);
CREATE INDEX idx_referral_discounts_referral_id ON referral_discounts(referral_id);

-- Enable RLS
ALTER TABLE referral_discounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_discounts
CREATE POLICY "Users can view their own discounts" ON referral_discounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own discount usage" ON referral_discounts
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- UPDATED FUNCTIONS FOR DISCOUNT SYSTEM
-- =============================================================================

-- Function to create discounts when a referral is processed
CREATE OR REPLACE FUNCTION create_referral_discounts(
    p_referrer_id UUID,
    p_referee_id UUID,
    p_referral_id UUID,
    p_discount_percentage DECIMAL DEFAULT 0.20
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create discount for referrer
    INSERT INTO referral_discounts (
        user_id,
        discount_type,
        discount_percentage,
        referral_id
    ) VALUES (
        p_referrer_id,
        'referrer',
        p_discount_percentage,
        p_referral_id
    );
    
    -- Create discount for referee
    INSERT INTO referral_discounts (
        user_id,
        discount_type,
        discount_percentage,
        referral_id
    ) VALUES (
        p_referee_id,
        'referee',
        p_discount_percentage,
        p_referral_id
    );
END;
$$;

-- Function to get available discounts for a user
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
    RETURN QUERY
    SELECT 
        rd.id,
        rd.discount_type,
        rd.discount_percentage,
        rd.expires_at,
        rd.created_at
    FROM referral_discounts rd
    WHERE rd.user_id = p_user_id
      AND rd.is_used = FALSE
      AND rd.expires_at > NOW()
    ORDER BY rd.created_at ASC;
END;
$$;

-- Function to use a discount
CREATE OR REPLACE FUNCTION use_referral_discount(
    p_discount_id UUID,
    p_user_id UUID
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
    WHERE rd.id = p_discount_id AND rd.user_id = p_user_id;
    
    -- Check if discount exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.0::DECIMAL(5,4), 'Discount not found or not owned by user';
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

-- Function to clean up expired discounts (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_discounts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM referral_discounts
    WHERE expires_at < NOW() - INTERVAL '7 days'  -- Keep expired discounts for 7 days for audit
      AND is_used = FALSE;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- =============================================================================
-- UPDATE EXISTING REFERRAL PROCESSING FUNCTION
-- =============================================================================

-- Update the process_referral_signup function to create discounts instead of bonus shots
CREATE OR REPLACE FUNCTION process_referral_signup(
    p_referral_code VARCHAR(8),
    p_referee_id UUID
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
    v_referrer_id UUID;
    v_referral_id UUID;
    v_discount_percentage DECIMAL(5,4) := 0.20; -- 20% discount from env config
BEGIN
    -- Find the referral code and get referrer info
    SELECT rc.user_id
    INTO v_referrer_id
    FROM referral_codes rc
    WHERE rc.code = p_referral_code
      AND rc.is_active = TRUE;
    
    -- Check if referral code exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid or inactive referral code';
        RETURN;
    END IF;
    
    -- Check if user is trying to refer themselves
    IF v_referrer_id = p_referee_id THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Cannot refer yourself';
        RETURN;
    END IF;
    
    -- Check if this referral already exists
    IF EXISTS (
        SELECT 1 FROM referrals r
        WHERE r.referrer_id = v_referrer_id
          AND r.referee_id = p_referee_id
    ) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Referral already exists';
        RETURN;
    END IF;
    
    -- Create the referral record
    INSERT INTO referrals (referrer_id, referee_id)
    VALUES (v_referrer_id, p_referee_id)
    RETURNING id INTO v_referral_id;
    
    -- Create discounts for both referrer and referee
    PERFORM create_referral_discounts(
        v_referrer_id,
        p_referee_id,
        v_referral_id,
        v_discount_percentage
    );
    
    RETURN QUERY SELECT TRUE, v_referrer_id, 'Referral processed successfully with discounts created';
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions for the new table and functions
GRANT SELECT, UPDATE ON referral_discounts TO authenticated;
GRANT EXECUTE ON FUNCTION create_referral_discounts TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_discounts TO authenticated;
GRANT EXECUTE ON FUNCTION use_referral_discount TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_discounts TO service_role;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration:
-- 1. Removes the bonus_shots table completely
-- 2. Creates a new referral_discounts table for tracking discount availability
-- 3. Updates all related functions to work with discounts instead of bonus shots
-- 4. Maintains the same referral tracking but changes the reward mechanism
-- 5. Ensures economic sustainability by providing discounts rather than free shots
-- 6. Allows configurable discount percentages and expiration times
-- 7. Includes proper RLS policies and indexes for performance