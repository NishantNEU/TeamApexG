-- Run this in your Supabase SQL Editor to create the Guildage integration tables.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

-- Synced Guildage agents
CREATE TABLE IF NOT EXISTS guildage_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT,
  skills JSONB DEFAULT '[]',
  token_balance REAL DEFAULT 0,
  deposit_sats INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guildage events (swaps, borrows, tasks)
CREATE TABLE IF NOT EXISTS guildage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL,
  source TEXT DEFAULT 'guildage',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration verification logs (also written by /api/integration/verify)
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT,
  agent_name TEXT,
  service_type TEXT,
  score INTEGER,
  passed BOOLEAN,
  trust_tier TEXT,
  source TEXT DEFAULT 'guildage',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime on guildage_events so the dashboard updates live
-- Run in Supabase Dashboard → Database → Replication, or:
-- ALTER PUBLICATION supabase_realtime ADD TABLE guildage_events;
-- ALTER PUBLICATION supabase_realtime ADD TABLE guildage_agents;
