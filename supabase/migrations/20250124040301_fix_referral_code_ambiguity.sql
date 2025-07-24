-- Fix ambiguous column reference in referral code functions
-- This addresses the "column reference 'code' is ambiguous" error

-- Drop and recreate the generate_referral_code function with proper column qualification
DROP FUNCTION IF EXISTS generate_referral_code();

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if code already exists (properly qualify the column reference)
        SELECT EXISTS(
            SELECT 1 FROM referral_codes 
            WHERE referral_codes.code = new_code
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the create_referral_code function with proper variable naming
DROP FUNCTION IF EXISTS create_referral_code(VARCHAR(42));

CREATE OR REPLACE FUNCTION create_referral_code(referrer_addr VARCHAR(42))
RETURNS VARCHAR(20) AS $$
DECLARE
    generated_code VARCHAR(20);
    existing_code VARCHAR(20);
BEGIN
    -- Check if player already has an active referral code
    SELECT referral_codes.code INTO existing_code 
    FROM referral_codes 
    WHERE referral_codes.referrer_address = referrer_addr 
    AND referral_codes.is_active = true 
    AND (referral_codes.expires_at IS NULL OR referral_codes.expires_at > NOW())
    LIMIT 1;
    
    -- Return existing code if found
    IF existing_code IS NOT NULL THEN
        RETURN existing_code;
    END IF;
    
    -- Generate new code
    generated_code := generate_referral_code();
    
    -- Insert new referral code
    INSERT INTO referral_codes (code, referrer_address)
    VALUES (generated_code, referrer_addr);
    
    RETURN generated_code;
END;
$$ LANGUAGE plpgsql;

-- Also fix the process_referral_signup function to be more explicit
DROP FUNCTION IF EXISTS process_referral_signup(VARCHAR(20), VARCHAR(42));

CREATE OR REPLACE FUNCTION process_referral_signup(ref_code VARCHAR(20), referee_addr VARCHAR(42))
RETURNS BOOLEAN AS $$
DECLARE
    code_record RECORD;
    referral_id UUID;
BEGIN
    -- Find valid referral code
    SELECT * INTO code_record
    FROM referral_codes
    WHERE referral_codes.code = ref_code
    AND referral_codes.is_active = true
    AND (referral_codes.expires_at IS NULL OR referral_codes.expires_at > NOW())
    AND (referral_codes.max_uses IS NULL OR referral_codes.total_uses < referral_codes.max_uses)
    AND referral_codes.referrer_address != referee_addr; -- Can't refer yourself
    
    -- Return false if code not found or invalid
    IF code_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if referee already used a referral code
    IF EXISTS(SELECT 1 FROM referrals WHERE referrals.referee_address = referee_addr) THEN
        RETURN false;
    END IF;
    
    -- Create referral record
    INSERT INTO referrals (referral_code_id, referrer_address, referee_address)
    VALUES (code_record.id, code_record.referrer_address, referee_addr)
    RETURNING id INTO referral_id;
    
    -- Update referral code usage count
    UPDATE referral_codes 
    SET total_uses = total_uses + 1 
    WHERE id = code_record.id;
    
    -- Give bonus shot to referee (new player bonus)
    INSERT INTO bonus_shots (player_address, bonus_type, amount, source_referral_id)
    VALUES (referee_addr, 'referral_signup', 1, referral_id);
    
    -- Give bonus shot to referrer (referral reward)
    INSERT INTO bonus_shots (player_address, bonus_type, amount, source_referral_id)
    VALUES (code_record.referrer_address, 'referral_reward', 1, referral_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;