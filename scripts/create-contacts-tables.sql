-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  civility text,
  first_name text,
  last_name text,
  full_name text NOT NULL,
  email text,
  phone text,
  mobile text,
  position text,
  is_primary integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_account_client ON contacts(account_id, client_id);

-- Create updated_at trigger for contacts
CREATE TRIGGER trg_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create client_comments table
CREATE TABLE IF NOT EXISTS client_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for client_comments
CREATE INDEX IF NOT EXISTS idx_client_comments_account_client ON client_comments(account_id, client_id);
