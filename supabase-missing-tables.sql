-- ============================================
-- Missing Tables for Planbase
-- Execute this SQL in Supabase or run: npx tsx scripts/push-missing-tables.ts
-- ============================================

-- Table: task_columns
CREATE TABLE IF NOT EXISTS task_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e5e7eb',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_columns_account_project 
ON task_columns(account_id, project_id);

CREATE TRIGGER trg_task_columns_updated_at
BEFORE UPDATE ON task_columns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Table: tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  column_id UUID REFERENCES task_columns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  assignees TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  progress INTEGER NOT NULL DEFAULT 0,
  position_in_column INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  effort INTEGER,
  created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_account_project_column 
ON tasks(account_id, project_id, column_id);

CREATE INDEX IF NOT EXISTS idx_tasks_account_client 
ON tasks(account_id, client_id);

CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Table: appointments (rendez-vous du calendrier)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_date_time TIMESTAMPTZ NOT NULL,
  end_date_time TIMESTAMPTZ,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  google_event_id TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_account_start 
ON appointments(account_id, start_date_time);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_google 
ON appointments(account_id, google_event_id) 
WHERE google_event_id IS NOT NULL;

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Table: google_calendar_tokens (tokens OAuth Google)
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tokens_unique 
ON google_calendar_tokens(account_id, user_id);

CREATE TRIGGER trg_google_calendar_tokens_updated_at
BEFORE UPDATE ON google_calendar_tokens
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Policies for new tables
ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- SELECT policies (all users in the account can read)
CREATE POLICY p_select_task_columns ON task_columns
FOR SELECT USING (account_id = current_account_id());

CREATE POLICY p_select_tasks ON tasks
FOR SELECT USING (account_id = current_account_id());

CREATE POLICY p_select_appointments ON appointments
FOR SELECT USING (account_id = current_account_id());

CREATE POLICY p_select_google_tokens ON google_calendar_tokens
FOR SELECT USING (account_id = current_account_id());

-- WRITE policies (owner & collaborator only)
CREATE POLICY p_write_task_columns ON task_columns
FOR ALL USING (account_id = current_account_id() AND current_user_role() IN ('owner','collaborator'))
WITH CHECK (account_id = current_account_id());

CREATE POLICY p_write_tasks ON tasks
FOR ALL USING (account_id = current_account_id() AND current_user_role() IN ('owner','collaborator'))
WITH CHECK (account_id = current_account_id());

CREATE POLICY p_write_appointments ON appointments
FOR ALL USING (account_id = current_account_id() AND current_user_role() IN ('owner','collaborator'))
WITH CHECK (account_id = current_account_id());

CREATE POLICY p_write_google_tokens ON google_calendar_tokens
FOR ALL USING (account_id = current_account_id() AND current_user_role() IN ('owner','collaborator'))
WITH CHECK (account_id = current_account_id());
