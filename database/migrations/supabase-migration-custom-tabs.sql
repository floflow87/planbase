-- Migration: Add client custom tabs, fields, and values tables
-- Run this in Supabase SQL Editor

-- Create client_custom_tabs table
CREATE TABLE IF NOT EXISTS client_custom_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_custom_tabs_account_id_idx ON client_custom_tabs(account_id);

-- Create trigger for updated_at
CREATE TRIGGER trg_client_custom_tabs_updated_at
BEFORE UPDATE ON client_custom_tabs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create client_custom_fields table
CREATE TABLE IF NOT EXISTS client_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tab_id UUID NOT NULL REFERENCES client_custom_tabs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  required INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_custom_fields_account_tab_idx ON client_custom_fields(account_id, tab_id);

-- Create trigger for updated_at
CREATE TRIGGER trg_client_custom_fields_updated_at
BEFORE UPDATE ON client_custom_fields
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create client_custom_field_values table
CREATE TABLE IF NOT EXISTS client_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES client_custom_fields(id) ON DELETE CASCADE,
  value JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_custom_field_values_account_client_idx ON client_custom_field_values(account_id, client_id);
CREATE INDEX IF NOT EXISTS client_custom_field_values_field_idx ON client_custom_field_values(field_id);

-- Create trigger for updated_at
CREATE TRIGGER trg_client_custom_field_values_updated_at
BEFORE UPDATE ON client_custom_field_values
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS on all tables
ALTER TABLE client_custom_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_custom_tabs
CREATE POLICY "Users can view their account's custom tabs"
ON client_custom_tabs FOR SELECT
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can insert custom tabs for their account"
ON client_custom_tabs FOR INSERT
WITH CHECK (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can update their account's custom tabs"
ON client_custom_tabs FOR UPDATE
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can delete their account's custom tabs"
ON client_custom_tabs FOR DELETE
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

-- RLS Policies for client_custom_fields
CREATE POLICY "Users can view their account's custom fields"
ON client_custom_fields FOR SELECT
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can insert custom fields for their account"
ON client_custom_fields FOR INSERT
WITH CHECK (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can update their account's custom fields"
ON client_custom_fields FOR UPDATE
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can delete their account's custom fields"
ON client_custom_fields FOR DELETE
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

-- RLS Policies for client_custom_field_values
CREATE POLICY "Users can view their account's field values"
ON client_custom_field_values FOR SELECT
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can insert field values for their account"
ON client_custom_field_values FOR INSERT
WITH CHECK (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can update their account's field values"
ON client_custom_field_values FOR UPDATE
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));

CREATE POLICY "Users can delete their account's field values"
ON client_custom_field_values FOR DELETE
USING (account_id IN (
  SELECT account_id FROM app_users WHERE id = auth.uid()
));
