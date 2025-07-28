-- Simplify Shot Recording - Only Insert Shots, Let Triggers Handle Players
-- 
-- This migration simplifies the shot recording to only insert into shots table
-- and relies on existing triggers to handle player stats updates properly.

-- Update the secure shot recording function to ONLY insert shots
CREATE OR REPLACE FUNCTION record_shot_secure(
    p_player_address TEXT,
    p_amount DECIMAL(20, 18),
    p_won BOOLEAN,
    p_tx_hash TEXT,
    p_block_number BIGINT,
    p_timestamp TIMESTAMPTZ,
    p_crypto_type TEXT DEFAULT 'ETH',
    p_contract_address TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    shot_record RECORD;
    current_user_address TEXT;
BEGIN
    -- Get the authenticated user's wallet address from JWT
    current_user_address := LOWER(COALESCE(
        current_setting('request.jwt.claims', true)::json->>'walletAddress',
        current_setting('request.jwt.claims', true)::json->>'wallet_address',
        current_setting('request.jwt.claims', true)::json->>'sub'
    ));
    
    -- Verify user is authenticated
    IF current_user_address IS NULL OR current_user_address = '' THEN
        RAISE EXCEPTION 'Authentication required: No wallet address in JWT token';
    END IF;
    
    -- Verify the wallet address matches the shot data (security check)
    IF LOWER(p_player_address) != current_user_address THEN
        RAISE EXCEPTION 'Access denied: Wallet address mismatch';
    END IF;
    
    -- ONLY insert the shot record - let existing triggers handle player stats
    INSERT INTO shots (
        player_address,
        amount,
        won,
        tx_hash,
        block_number,
        timestamp,
        crypto_type,
        contract_address
    )
    VALUES (
        LOWER(p_player_address),
        p_amount,
        p_won,
        p_tx_hash,
        p_block_number,
        p_timestamp,
        p_crypto_type,
        p_contract_address
    )
    RETURNING * INTO shot_record;
    
    -- Return the created shot record as JSON
    RETURN json_build_object(
        'id', shot_record.id,
        'player_address', shot_record.player_address,
        'amount', shot_record.amount,
        'won', shot_record.won,
        'tx_hash', shot_record.tx_hash,
        'block_number', shot_record.block_number,
        'timestamp', shot_record.timestamp,
        'crypto_type', shot_record.crypto_type,
        'contract_address', shot_record.contract_address,
        'created_at', shot_record.created_at
    );
END;
$$;

-- Update the secure winner recording function to ONLY insert winners
CREATE OR REPLACE FUNCTION record_winner_secure(
    p_winner_address TEXT,
    p_amount DECIMAL(20, 18),
    p_tx_hash TEXT,
    p_block_number BIGINT,
    p_timestamp TIMESTAMPTZ,
    p_crypto_type TEXT DEFAULT 'ETH',
    p_contract_address TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    winner_record RECORD;
    current_user_address TEXT;
BEGIN
    -- Get the authenticated user's wallet address from JWT
    current_user_address := LOWER(COALESCE(
        current_setting('request.jwt.claims', true)::json->>'walletAddress',
        current_setting('request.jwt.claims', true)::json->>'wallet_address',
        current_setting('request.jwt.claims', true)::json->>'sub'
    ));
    
    -- Verify user is authenticated
    IF current_user_address IS NULL OR current_user_address = '' THEN
        RAISE EXCEPTION 'Authentication required: No wallet address in JWT token';
    END IF;
    
    -- Verify the wallet address matches the winner data (security check)
    IF LOWER(p_winner_address) != current_user_address THEN
        RAISE EXCEPTION 'Access denied: Wallet address mismatch';
    END IF;
    
    -- ONLY insert the winner record
    INSERT INTO winners (
        winner_address,
        amount,
        tx_hash,
        block_number,
        timestamp,
        crypto_type,
        contract_address
    )
    VALUES (
        LOWER(p_winner_address),
        p_amount,
        p_tx_hash,
        p_block_number,
        p_timestamp,
        p_crypto_type,
        p_contract_address
    )
    RETURNING * INTO winner_record;
    
    -- Return the created winner record as JSON
    RETURN json_build_object(
        'id', winner_record.id,
        'winner_address', winner_record.winner_address,
        'amount', winner_record.amount,
        'tx_hash', winner_record.tx_hash,
        'block_number', winner_record.block_number,
        'timestamp', winner_record.timestamp,
        'crypto_type', winner_record.crypto_type,
        'contract_address', winner_record.contract_address,
        'created_at', winner_record.created_at
    );
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION record_shot_secure IS 'Securely record a shot with JWT authentication - only inserts shots, triggers handle player stats';
COMMENT ON FUNCTION record_winner_secure IS 'Securely record a winner with JWT authentication - only inserts winners';