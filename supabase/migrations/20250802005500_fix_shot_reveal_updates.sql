-- Fix Shot Reveal Updates
-- 
-- This migration adds functionality to properly update shot records when they are revealed,
-- ensuring that winning shots are marked as won in the database.

-- Create a function to update shot records when revealed
CREATE OR REPLACE FUNCTION update_shot_on_reveal(
    p_tx_hash TEXT,
    p_won BOOLEAN,
    p_reveal_tx_hash TEXT DEFAULT NULL,
    p_reveal_block_number INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the shot record with reveal information
    UPDATE shots 
    SET 
        won = p_won,
        reveal_tx_hash = p_reveal_tx_hash,
        reveal_block_number = p_reveal_block_number,
        reveal_timestamp = NOW(),
        updated_at = NOW()
    WHERE tx_hash = p_tx_hash;
    
    -- Check if any rows were updated
    IF FOUND THEN
        -- Log the update
        RAISE NOTICE 'Updated shot record for tx_hash: %, won: %', p_tx_hash, p_won;
        RETURN TRUE;
    ELSE
        -- Log that no record was found
        RAISE NOTICE 'No shot record found for tx_hash: %', p_tx_hash;
        RETURN FALSE;
    END IF;
END;
$$;

-- Create a function to get shot details by transaction hash
CREATE OR REPLACE FUNCTION get_shot_by_tx_hash(p_tx_hash TEXT)
RETURNS TABLE (
    id INTEGER,
    player_address TEXT,
    amount DECIMAL,
    won BOOLEAN,
    tx_hash TEXT,
    block_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    reveal_tx_hash TEXT,
    reveal_block_number INTEGER,
    reveal_timestamp TIMESTAMP WITH TIME ZONE,
    crypto_type TEXT,
    contract_address TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.player_address,
        s.amount,
        s.won,
        s.tx_hash,
        s.block_number,
        s.created_at,
        s.reveal_tx_hash,
        s.reveal_block_number,
        s.reveal_timestamp,
        s.crypto_type,
        s.contract_address
    FROM shots s
    WHERE s.tx_hash = p_tx_hash;
END;
$$;

-- Add reveal-related columns to shots table if they don't exist
DO $$
BEGIN
    -- Add reveal_tx_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shots' AND column_name = 'reveal_tx_hash'
    ) THEN
        ALTER TABLE shots ADD COLUMN reveal_tx_hash TEXT;
    END IF;
    
    -- Add reveal_block_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shots' AND column_name = 'reveal_block_number'
    ) THEN
        ALTER TABLE shots ADD COLUMN reveal_block_number INTEGER;
    END IF;
    
    -- Add reveal_timestamp column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shots' AND column_name = 'reveal_timestamp'
    ) THEN
        ALTER TABLE shots ADD COLUMN reveal_timestamp TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_shot_on_reveal TO authenticated;
GRANT EXECUTE ON FUNCTION get_shot_by_tx_hash TO authenticated, anon;

-- Add helpful comments
COMMENT ON FUNCTION update_shot_on_reveal IS 'Updates a shot record with reveal information including win/loss status';
COMMENT ON FUNCTION get_shot_by_tx_hash IS 'Retrieves shot details by transaction hash';

-- Create indexes for better performance on reveal-related queries
CREATE INDEX IF NOT EXISTS idx_shots_reveal_tx_hash ON shots (reveal_tx_hash) WHERE reveal_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shots_won ON shots (won) WHERE won = true;

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Shot reveal update functionality added successfully';
END $$;