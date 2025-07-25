-- =============================================================================
-- UPDATE REFERRAL STATS FUNCTION FOR DISCOUNT SYSTEM
-- =============================================================================
-- This migration updates the get_referral_stats function to work with the new
-- discount system instead of the old bonus shots system.

-- Update the get_referral_stats function to return discount-based data
CREATE OR REPLACE FUNCTION get_referral_stats(player_addr VARCHAR(42))
RETURNS JSON AS $$
DECLARE
    stats JSON;
    user_uuid UUID;
BEGIN
    -- First, we need to get the user_id from the wallet address
    -- This assumes there's a way to map wallet addresses to user IDs
    -- For now, we'll use the referral_codes table to find the user
    SELECT rc.user_id INTO user_uuid
    FROM referral_codes rc
    WHERE rc.referrer_address = player_addr
    LIMIT 1;
    
    -- If no user found in referral_codes, try to find in referrals table
    IF user_uuid IS NULL THEN
        -- This is a fallback - in a real system you'd have a proper user mapping
        -- For now, we'll create a deterministic UUID from the address
        user_uuid := md5(player_addr)::uuid;
    END IF;
    
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
            WHERE rd.user_id = user_uuid
              AND rd.is_used = FALSE
              AND rd.expires_at > NOW()
        ),
        'total_discounts_earned', (
            SELECT COUNT(*)
            FROM referral_discounts rd
            WHERE rd.user_id = user_uuid
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_referral_stats TO authenticated;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration:
-- 1. Updates the get_referral_stats function to return discount-based data
-- 2. Replaces bonus_shots_available with available_discounts
-- 3. Replaces total_bonus_shots_earned with total_discounts_earned
-- 4. Maintains compatibility with existing referral tracking
-- 5. Uses the new referral_discounts table for discount calculations