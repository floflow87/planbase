-- ===========================================
-- Mindmap Tables for Planbase
-- Execute this SQL in Supabase SQL Editor
-- ===========================================

-- 1) Table mindmaps (main mindmap container)
CREATE TABLE IF NOT EXISTS mindmaps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title         text NOT NULL,
  kind          text NOT NULL DEFAULT 'generic' CHECK (kind IN ('generic', 'user_journey', 'storyboard', 'sitemap', 'architecture', 'brainstorm')),
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    uuid NOT NULL REFERENCES app_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindmaps_account_idx ON mindmaps(account_id);
CREATE INDEX IF NOT EXISTS mindmaps_client_idx ON mindmaps(account_id, client_id);
CREATE INDEX IF NOT EXISTS mindmaps_project_idx ON mindmaps(account_id, project_id);

CREATE TRIGGER trg_mindmaps_updated_at
BEFORE UPDATE ON mindmaps
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) Table mindmap_nodes (nodes within a mindmap)
CREATE TABLE IF NOT EXISTS mindmap_nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mindmap_id          uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type                text NOT NULL DEFAULT 'idea' CHECK (type IN ('idea', 'note', 'project', 'document', 'task', 'client', 'generic')),
  title               text NOT NULL,
  description         text,
  image_url           text,
  linked_entity_type  text CHECK (linked_entity_type IS NULL OR linked_entity_type IN ('note', 'project', 'document', 'task', 'client')),
  linked_entity_id    uuid,
  x                   float NOT NULL DEFAULT 0,
  y                   float NOT NULL DEFAULT 0,
  style               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindmap_nodes_mindmap_idx ON mindmap_nodes(mindmap_id);
CREATE INDEX IF NOT EXISTS mindmap_nodes_account_idx ON mindmap_nodes(account_id);
CREATE INDEX IF NOT EXISTS mindmap_nodes_linked_entity_idx ON mindmap_nodes(linked_entity_type, linked_entity_id);

CREATE TRIGGER trg_mindmap_nodes_updated_at
BEFORE UPDATE ON mindmap_nodes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) Table mindmap_edges (connections between nodes)
CREATE TABLE IF NOT EXISTS mindmap_edges (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mindmap_id            uuid NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  account_id            uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_node_id        uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  target_node_id        uuid NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
  is_draft              boolean NOT NULL DEFAULT true,
  linked_entity_link_id uuid,
  label                 text,
  style                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mindmap_edges_mindmap_idx ON mindmap_edges(mindmap_id);
CREATE INDEX IF NOT EXISTS mindmap_edges_account_idx ON mindmap_edges(account_id);
CREATE INDEX IF NOT EXISTS mindmap_edges_source_idx ON mindmap_edges(source_node_id);
CREATE INDEX IF NOT EXISTS mindmap_edges_target_idx ON mindmap_edges(target_node_id);

CREATE TRIGGER trg_mindmap_edges_updated_at
BEFORE UPDATE ON mindmap_edges
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4) Table entity_links (for connecting entities across the app)
CREATE TABLE IF NOT EXISTS entity_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type       text NOT NULL CHECK (source_type IN ('note', 'project', 'document', 'task', 'client')),
  source_id         uuid NOT NULL,
  target_type       text NOT NULL CHECK (target_type IN ('note', 'project', 'document', 'task', 'client')),
  target_id         uuid NOT NULL,
  created_by        uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_links_account_idx ON entity_links(account_id);
CREATE INDEX IF NOT EXISTS entity_links_source_idx ON entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS entity_links_target_idx ON entity_links(target_type, target_id);

-- 5) RLS Policies for mindmaps
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mindmaps_select_own_account" ON mindmaps;
CREATE POLICY "mindmaps_select_own_account" ON mindmaps
  FOR SELECT USING (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmaps_insert_own_account" ON mindmaps;
CREATE POLICY "mindmaps_insert_own_account" ON mindmaps
  FOR INSERT WITH CHECK (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmaps_update_own_account" ON mindmaps;
CREATE POLICY "mindmaps_update_own_account" ON mindmaps
  FOR UPDATE USING (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmaps_delete_own_account" ON mindmaps;
CREATE POLICY "mindmaps_delete_own_account" ON mindmaps
  FOR DELETE USING (account_id = current_account_id());

-- 6) RLS Policies for mindmap_nodes
ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mindmap_nodes_select_own_account" ON mindmap_nodes;
CREATE POLICY "mindmap_nodes_select_own_account" ON mindmap_nodes
  FOR SELECT USING (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmap_nodes_insert_own_account" ON mindmap_nodes;
CREATE POLICY "mindmap_nodes_insert_own_account" ON mindmap_nodes
  FOR INSERT WITH CHECK (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmap_nodes_update_own_account" ON mindmap_nodes;
CREATE POLICY "mindmap_nodes_update_own_account" ON mindmap_nodes
  FOR UPDATE USING (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmap_nodes_delete_own_account" ON mindmap_nodes;
CREATE POLICY "mindmap_nodes_delete_own_account" ON mindmap_nodes
  FOR DELETE USING (account_id = current_account_id());

-- 7) RLS Policies for mindmap_edges
ALTER TABLE mindmap_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mindmap_edges_select_own_account" ON mindmap_edges;
CREATE POLICY "mindmap_edges_select_own_account" ON mindmap_edges
  FOR SELECT USING (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmap_edges_insert_own_account" ON mindmap_edges;
CREATE POLICY "mindmap_edges_insert_own_account" ON mindmap_edges
  FOR INSERT WITH CHECK (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmap_edges_update_own_account" ON mindmap_edges;
CREATE POLICY "mindmap_edges_update_own_account" ON mindmap_edges
  FOR UPDATE USING (account_id = current_account_id());

DROP POLICY IF EXISTS "mindmap_edges_delete_own_account" ON mindmap_edges;
CREATE POLICY "mindmap_edges_delete_own_account" ON mindmap_edges
  FOR DELETE USING (account_id = current_account_id());

-- 8) RLS Policies for entity_links
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity_links_select_own_account" ON entity_links;
CREATE POLICY "entity_links_select_own_account" ON entity_links
  FOR SELECT USING (account_id = current_account_id());

DROP POLICY IF EXISTS "entity_links_insert_own_account" ON entity_links;
CREATE POLICY "entity_links_insert_own_account" ON entity_links
  FOR INSERT WITH CHECK (account_id = current_account_id());

DROP POLICY IF EXISTS "entity_links_update_own_account" ON entity_links;
CREATE POLICY "entity_links_update_own_account" ON entity_links
  FOR UPDATE USING (account_id = current_account_id());

DROP POLICY IF EXISTS "entity_links_delete_own_account" ON entity_links;
CREATE POLICY "entity_links_delete_own_account" ON entity_links
  FOR DELETE USING (account_id = current_account_id());

-- Success message
DO $$ BEGIN RAISE NOTICE 'Mindmap tables created successfully with RLS policies!'; END $$;
