-- Referral System Migration
-- Adds tables and functions to support referral tracking and bonus shots

-- Create referral_codes table to track unique referral codes
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    referrer_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days'),
    is_active BOOLEAN DEFAULT true,
    total_uses INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT NULL -- NULL means unlimited
);

-- Create referrals table to track successful referrals
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referral_code_id UUID REFERENCES referral_codes(id) ON DELETE CASCADE,
    referrer_address VARCHAR(42) NOT NULL,
    referee_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_shot_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    referrer_bonus_claimed BOOLEAN DEFAULT false,
    referee_bonus_claimed BOOLEAN DEFAULT false,
    
    -- Ensure one referral per referee
    UNIQUE(referee_address)
);

-- Create bonus_shots table to track available bonus shots
CREATE TABLE IF NOT EXISTS bonus_shots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_address VARCHAR(42) NOT NULL,
    bonus_type VARCHAR(50) NOT NULL, -- 'referral_signup', 'referral_reward', 'daily_bonus', etc.
    amount INTEGER NOT NULL DEFAULT 1,
    source_referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_used BOOLEAN DEFAULT false
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_referrer ON referral_codes(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_address);
CREATE INDEX IF NOT EXISTS idx_bonus_shots_player ON bonus_shots(player_address);
CREATE INDEX IF NOT EXISTS idx_bonus_shots_unused ON bonus_shots(player_address, is_used) WHERE is_used = false;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM referral_codes WHERE referral_codes.code = code) INTO exists;
        
        -- Exit loop if code is unique
        IF NOT exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to create referral code for a player
CREATE OR REPLACE FUNCTION create_referral_code(referrer_addr VARCHAR(42))
RETURNS VARCHAR(20) AS $$
DECLARE
    new_code VARCHAR(20);
    existing_code VARCHAR(20);
BEGIN
    -- Check if player already has an active referral code
    SELECT code INTO existing_code 
    FROM referral_codes 
    WHERE referrer_address = referrer_addr 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;
    
    -- Return existing code if found
    IF existing_code IS NOT NULL THEN
        RETURN existing_code;
    END IF;
    
    -- Generate new code
    new_code := generate_referral_code();
    
    -- Insert new referral code
    INSERT INTO referral_codes (code, referrer_address)
    VALUES (new_code, referrer_addr);
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to process referral signup
CREATE OR REPLACE FUNCTION process_referral_signup(ref_code VARCHAR(20), referee_addr VARCHAR(42))
RETURNS BOOLEAN AS $$
DECLARE
    code_record RECORD;
    referral_id UUID;
BEGIN
    -- Find valid referral code
    SELECT * INTO code_record
    FROM referral_codes
    WHERE code = ref_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR total_uses < max_uses)
    AND referrer_address != referee_addr; -- Can't refer yourself
    
    -- Return false if code not found or invalid
    IF code_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if referee already used a referral code
    IF EXISTS(SELECT 1 FROM referrals WHERE referee_address = referee_addr) THEN
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

-- Function to get available bonus shots for a player
CREATE OR REPLACE FUNCTION get_bonus_shots(player_addr VARCHAR(42))
RETURNS INTEGER AS $$
DECLARE
    bonus_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO bonus_count
    FROM bonus_shots
    WHERE player_address = player_addr
    AND is_used = false
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN bonus_count;
END;
$$ LANGUAGE plpgsql;

-- Function to use a bonus shot
CREATE OR REPLACE FUNCTION use_bonus_shot(player_addr VARCHAR(42))
RETURNS BOOLEAN AS $$
DECLARE
    bonus_record RECORD;
BEGIN
    -- Find oldest unused bonus shot
    SELECT * INTO bonus_record
    FROM bonus_shots
    WHERE player_address = player_addr
    AND is_used = false
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Return false if no bonus shots available
    IF bonus_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- Mark bonus shot as used
    UPDATE bonus_shots
    SET is_used = true, used_at = NOW()
    WHERE id = bonus_record.id;
    
    -- Update referral record if this was the referee's first shot
    IF bonus_record.bonus_type = 'referral_signup' AND bonus_record.source_referral_id IS NOT NULL THEN
        UPDATE referrals
        SET first_shot_at = NOW(), referee_bonus_claimed = true
        WHERE id = bonus_record.source_referral_id;
    END IF;
    
    -- Update referral record if this was the referrer's reward
    IF bonus_record.bonus_type = 'referral_reward' AND bonus_record.source_referral_id IS NOT NULL THEN
        UPDATE referrals
        SET referrer_bonus_claimed = true
        WHERE id = bonus_record.source_referral_id;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get referral stats for a player
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
        'bonus_shots_available', get_bonus_shots(player_addr),
        'total_bonus_shots_earned', (
            SELECT COALESCE(SUM(amount), 0)
            FROM bonus_shots
            WHERE player_address = player_addr
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

-- Enable Row Level Security
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_shots ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow read access for referral functionality)
CREATE POLICY "Allow read access to referral codes" ON referral_codes FOR SELECT USING (true);
CREATE POLICY "Allow read access to referrals" ON referrals FOR SELECT USING (true);
CREATE POLICY "Allow read access to bonus shots" ON bonus_shots FOR SELECT USING (true);

-- Allow insert for referral system functions
CREATE POLICY "Allow insert referral codes" ON referral_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert referrals" ON referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert bonus shots" ON bonus_shots FOR INSERT WITH CHECK (true);

-- Allow updates for referral system functions
CREATE POLICY "Allow update referral codes" ON referral_codes FOR UPDATE USING (true);
CREATE POLICY "Allow update referrals" ON referrals FOR UPDATE USING (true);
CREATE POLICY "Allow update bonus shots" ON bonus_shots FOR UPDATE USING (true);