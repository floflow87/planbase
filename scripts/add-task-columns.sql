-- Add task_columns table for Kanban board customization
CREATE TABLE IF NOT EXISTS task_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e5e7eb',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_columns_account_project_idx ON task_columns(account_id, project_id);

-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS column_id UUID REFERENCES task_columns(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position_in_column INTEGER NOT NULL DEFAULT 0;

-- Update existing index on tasks
DROP INDEX IF EXISTS tasks_account_project_status_idx;
CREATE INDEX IF NOT EXISTS tasks_account_project_column_idx ON tasks(account_id, project_id, column_id);

-- Insert default columns for existing projects
INSERT INTO task_columns (account_id, project_id, name, color, "order", is_locked)
SELECT 
  p.account_id,
  p.id,
  'À faire',
  '#e5e7eb', -- Light gray
  0,
  1 -- Locked
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM task_columns tc 
  WHERE tc.project_id = p.id AND tc.name = 'À faire'
);

INSERT INTO task_columns (account_id, project_id, name, color, "order", is_locked)
SELECT 
  p.account_id,
  p.id,
  'En cours',
  '#bfdbfe', -- Light blue
  1,
  0
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM task_columns tc 
  WHERE tc.project_id = p.id AND tc.name = 'En cours'
);

INSERT INTO task_columns (account_id, project_id, name, color, "order", is_locked)
SELECT 
  p.account_id,
  p.id,
  'En révision',
  '#fde68a', -- Light yellow
  2,
  0
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM task_columns tc 
  WHERE tc.project_id = p.id AND tc.name = 'En révision'
);

INSERT INTO task_columns (account_id, project_id, name, color, "order", is_locked)
SELECT 
  p.account_id,
  p.id,
  'Terminé',
  '#d1fae5', -- Ultra-light pastel green
  3,
  1 -- Locked
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM task_columns tc 
  WHERE tc.project_id = p.id AND tc.name = 'Terminé'
);

-- Link existing tasks to their appropriate columns
UPDATE tasks t
SET column_id = (
  SELECT tc.id FROM task_columns tc
  WHERE tc.project_id = t.project_id
    AND (
      (t.status = 'todo' AND tc.name = 'À faire')
      OR (t.status = 'in_progress' AND tc.name = 'En cours')
      OR (t.status = 'review' AND tc.name = 'En révision')
      OR (t.status = 'done' AND tc.name = 'Terminé')
    )
  LIMIT 1
)
WHERE t.column_id IS NULL;
