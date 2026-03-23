-- Invitations table for invitation-only registration
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_by TEXT DEFAULT 'system',
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invitations_code ON invitations(code);
CREATE INDEX idx_invitations_org ON invitations(org_id);

-- Add phone to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- RLS for invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can validate an invitation code (needed for registration)
CREATE POLICY "Anyone can read active invitations" ON invitations FOR SELECT
  USING (status = 'active');

-- Service role manages invitations
CREATE POLICY "Service role manages invitations" ON invitations FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read invitations for their org (for admin panel)
CREATE POLICY "Users can read own org invitations" ON invitations FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Allow users to read other users in their org (for admin panel)
CREATE POLICY "Users can read org members" ON users FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid()));
