-- OpenRink Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leagues table
CREATE TABLE leagues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  season TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rinks table
CREATE TABLE rinks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#0284c7',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table (roster management)
CREATE TABLE players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  jersey_number INTEGER,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  game_time TIME NOT NULL,
  rink_id UUID REFERENCES rinks(id),
  surface_name TEXT DEFAULT 'NHL',
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment tracking (dues)
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  venmo_link TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, overdue
  due_date DATE,
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sub requests
CREATE TABLE sub_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  requesting_player_id UUID REFERENCES players(id),
  substitute_player_id UUID REFERENCES players(id),
  status TEXT DEFAULT 'open', -- open, filled, cancelled
  payment_required BOOLEAN DEFAULT false,
  payment_amount DECIMAL(10,2),
  venmo_link TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications log
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  type TEXT, -- game_reminder, sub_request, payment_due, league_announcement
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_teams_league ON teams(league_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_games_teams ON games(home_team_id, away_team_id);
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_payments_player ON payments(player_id);
CREATE INDEX idx_sub_requests_game ON sub_requests(game_id);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE rinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read access for most tables (authenticated users)
CREATE POLICY "Allow read access for authenticated users" ON leagues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON rinks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON teams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON games
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON sub_requests
  FOR SELECT TO authenticated USING (true);

-- Insert policies (authenticated users can create)
CREATE POLICY "Allow insert for authenticated users" ON leagues
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow insert for authenticated users" ON rinks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow insert for authenticated users" ON teams
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow insert for authenticated users" ON players
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow insert for authenticated users" ON games
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow insert for authenticated users" ON payments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow insert for authenticated users" ON sub_requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- Update policies (authenticated users can update)
CREATE POLICY "Allow update for authenticated users" ON leagues
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow update for authenticated users" ON teams
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow update for authenticated users" ON players
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow update for authenticated users" ON games
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow update for authenticated users" ON payments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow update for authenticated users" ON sub_requests
  FOR UPDATE TO authenticated USING (true);

-- Delete policies (authenticated users can delete)
CREATE POLICY "Allow delete for authenticated users" ON leagues
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON teams
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON players
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON games
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated users" ON sub_requests
  FOR DELETE TO authenticated USING (true);

-- Insert some sample rinks
INSERT INTO rinks (name, address) VALUES
  ('IceCenter', '123 Hockey Lane, Ice Town, USA'),
  ('Twin Rinks Arena', '456 Skate Street, Puck City, USA');
