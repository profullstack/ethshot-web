-- Migration: add unique index on shots.tx_hash to support upserts and prevent duplicates
-- Description: Satisfies ON CONFLICT(tx_hash) and improves query performance
-- Safe to run multiple times due to IF NOT EXISTS guards

begin;

do $$
begin
  if to_regclass('public.shots') is not null then
    -- Unique index enables ON CONFLICT(tx_hash) operations
    execute 'create unique index if not exists shots_tx_hash_uidx on public.shots (tx_hash)';

    -- Helpful query index for listing/filtering by player and time
    execute 'create index if not exists shots_player_ts_idx on public.shots (player_address, timestamp)';
  else
    raise notice 'Table public.shots not found; skipping index creation';
  end if;
end $$;

commit;