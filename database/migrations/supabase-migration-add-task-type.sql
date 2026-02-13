-- Migration: Add task_type column to backlog_tasks table
-- This allows distinguishing between regular tasks and bugs
-- Date: 2026-01-13

-- Add task_type column to backlog_tasks
ALTER TABLE backlog_tasks 
ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'task';

-- Update all existing rows to have 'task' as default (if not already set)
UPDATE backlog_tasks SET task_type = 'task' WHERE task_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN backlog_tasks.task_type IS 'Type of task: task or bug';
