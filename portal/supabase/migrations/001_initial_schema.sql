-- Organizations (pre-seeded with 2,926 SK municipalities + 8 VÚC)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'SK',
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vuc', 'mesto', 'mestska_cast', 'obec', 'zdruzenie', 'sme', 'ngo', 'skola', 'stat')),
  parent_id UUID REFERENCES organizations(id),
  reg_id TEXT,  -- IČO for SK
  population INTEGER,
  gps_lat DECIMAL,
  gps_lng DECIMAL,
  region TEXT,
  district TEXT,
  metadata JSONB DEFAULT '{}',
  claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_org_reg_id ON organizations(reg_id);
CREATE INDEX idx_org_entity_type ON organizations(entity_type);
CREATE INDEX idx_org_country ON organizations(country);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  org_id UUID REFERENCES organizations(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor', 'viewer')),
  locale TEXT DEFAULT 'sk',
  notification_frequency TEXT DEFAULT 'weekly' CHECK (notification_frequency IN ('daily', 'weekly', 'none')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Fund calls (výzvy)
CREATE TABLE fund_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  country TEXT NOT NULL DEFAULT 'SK',
  program TEXT,
  priority_axis TEXT,
  specific_objective TEXT,
  managing_authority TEXT,
  eligible_entity_types TEXT[],
  eligible_regions TEXT[],
  excluded_regions TEXT[],
  population_min INTEGER,
  population_max INTEGER,
  min_grant_eur DECIMAL,
  max_grant_eur DECIMAL,
  cofinancing_rate DECIMAL,
  published_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  allocation_eur DECIMAL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  source_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calls_status ON fund_calls(status);
CREATE INDEX idx_calls_deadline ON fund_calls(deadline);
CREATE INDEX idx_calls_country ON fund_calls(country);

-- Call matches
CREATE TABLE call_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  call_id UUID REFERENCES fund_calls(id) NOT NULL,
  relevance_score DECIMAL,
  match_reasons TEXT[],
  notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, call_id)
);

CREATE INDEX idx_matches_org ON call_matches(org_id);

-- Subscriptions (free tier only for V0)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  price_eur_monthly DECIMAL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Organizations: allow reading unclaimed orgs (for registration IČO lookup) + own org
CREATE POLICY "Anyone can read unclaimed orgs" ON organizations FOR SELECT
  USING (claimed = false);

CREATE POLICY "Users can read own org" ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Organizations: service role can insert/update (for seeding and registration)
CREATE POLICY "Service role manages orgs" ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- Users: own record only
CREATE POLICY "Users can read own record" ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own record" ON users FOR UPDATE
  USING (id = auth.uid());

-- Fund calls: public read
CREATE POLICY "Fund calls are public" ON fund_calls FOR SELECT
  USING (true);

-- Call matches: own org only
CREATE POLICY "Users can read own matches" ON call_matches FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own matches" ON call_matches FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Subscriptions: own org only
CREATE POLICY "Users can read own subscription" ON subscriptions FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
