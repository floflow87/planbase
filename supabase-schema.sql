-- ===========================================
-- Complete Supabase Schema for Planbase
-- Execute this SQL in Supabase SQL Editor
-- ===========================================

-- 0) Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- 1) Helpers (updated_at trigger)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Helpers pour claims (Supabase Auth JWT)
create or replace function current_account_id() returns uuid
language sql stable as
$$ select coalesce( (auth.jwt() ->> 'account_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid ) $$;

create or replace function current_role() returns text
language sql stable as
$$ select coalesce( auth.jwt() ->> 'role', 'anonymous' ) $$;

-- 2) Drop existing tables if they exist (clean slate)
drop table if exists roadmap_items cascade;
drop table if exists roadmaps cascade;
drop table if exists features cascade;
drop table if exists product_integrations cascade;
drop table if exists products cascade;
drop table if exists email_attachments cascade;
drop table if exists emails cascade;
drop table if exists mail_accounts cascade;
drop table if exists file_shares cascade;
drop table if exists file_versions cascade;
drop table if exists files cascade;
drop table if exists folders cascade;
drop table if exists note_files cascade;
drop table if exists note_shares cascade;
drop table if exists note_versions cascade;
drop table if exists note_tags cascade;
drop table if exists tags cascade;
drop table if exists note_links cascade;
drop table if exists notes cascade;
drop table if exists note_embeddings cascade;
drop table if exists file_embeddings cascade;
drop table if exists activities cascade;
drop table if exists deals cascade;
drop table if exists projects cascade;
drop table if exists clients cascade;
drop table if exists invitations cascade;
drop table if exists app_users cascade;
drop table if exists accounts cascade;
drop table if exists users cascade;
drop table if exists tasks cascade;
drop table if exists documents cascade;

-- 3) Comptes & Utilisateurs (multi-tenant)
create table accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid,
  plan          text default 'starter',
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_accounts_updated_at
before update on accounts
for each row execute function set_updated_at();

create table app_users (
  id            uuid primary key,
  account_id    uuid not null references accounts(id) on delete cascade,
  email         text not null,
  role          text not null check (role in ('owner','collaborator','client_viewer')),
  profile       jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on app_users (account_id);
create trigger trg_app_users_updated_at
before update on app_users
for each row execute function set_updated_at();

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  email         text not null,
  role          text not null check (role in ('collaborator','client_viewer')),
  status        text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  token         text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on invitations (account_id, status);
create trigger trg_invitations_updated_at
before update on invitations
for each row execute function set_updated_at();

-- 4) CRM & Pipeline
create table clients (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  type          text not null default 'company' check (type in ('company','person')),
  name          text not null,
  contacts      jsonb not null default '[]',
  tags          text[] not null default '{}',
  status        text not null default 'prospecting',
  budget        numeric(14,2),
  notes         text,
  created_by    uuid not null references app_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on clients (account_id, name);
create trigger trg_clients_updated_at
before update on clients
for each row execute function set_updated_at();

create table projects (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  client_id     uuid references clients(id) on delete set null,
  name          text not null,
  stage         text default 'discovery',
  budget        numeric(14,2),
  tags          text[] not null default '{}',
  meta          jsonb not null default '{}',
  created_by    uuid not null references app_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on projects (account_id, client_id);
create trigger trg_projects_updated_at
before update on projects
for each row execute function set_updated_at();

create table deals (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  client_id     uuid references clients(id) on delete set null,
  project_id    uuid references projects(id) on delete set null,
  title         text not null,
  value         numeric(14,2),
  stage         text not null default 'lead' check (stage in ('lead','qualified','proposal','won','lost')),
  probability   int check (probability between 0 and 100),
  close_date    date,
  created_by    uuid not null references app_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on deals (account_id, stage);
create trigger trg_deals_updated_at
before update on deals
for each row execute function set_updated_at();

create table activities (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  subject_type  text not null check (subject_type in ('client','deal','project')),
  subject_id    uuid not null,
  kind          text not null check (kind in ('email','call','meeting','note','task','file')),
  payload       jsonb not null default '{}',
  created_by    uuid references app_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on activities (account_id, subject_type, subject_id);

-- 5) Notes (Notion-like) + IA
create table notes (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  created_by    uuid not null references app_users(id) on delete set null,
  title         text not null default '',
  content       jsonb not null default '[]',
  plain_text    text,
  summary       text,
  status        text not null default 'active' check (status in ('draft','active','archived')),
  visibility    text not null default 'private' check (visibility in ('private','account','client_ro')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index notes_fts_idx on notes using gin (to_tsvector('simple', coalesce(plain_text,'')));
create index on notes (account_id, visibility);
create trigger trg_notes_updated_at
before update on notes
for each row execute function set_updated_at();

create table note_links (
  note_id      uuid references notes(id) on delete cascade,
  target_type  text not null check (target_type in ('project','task','meeting','file','client')),
  target_id    uuid not null,
  primary key (note_id, target_type, target_id)
);
create index on note_links (target_type, target_id);

create table tags (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  label       text not null,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on tags (account_id, label);
create trigger trg_tags_updated_at
before update on tags
for each row execute function set_updated_at();

create table note_tags (
  note_id     uuid references notes(id) on delete cascade,
  tag_id      uuid references tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create table note_versions (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid references notes(id) on delete cascade,
  version_no  int not null,
  title       text,
  content     jsonb,
  summary     text,
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on note_versions (note_id, version_no);

create table note_shares (
  note_id      uuid references notes(id) on delete cascade,
  subject_type text not null check (subject_type in ('user','client','role')),
  subject_id   uuid,
  permission   text not null check (permission in ('read','comment','edit')),
  primary key (note_id, subject_type, subject_id)
);

create table note_files (
  note_id   uuid references notes(id) on delete cascade,
  file_id   uuid not null,
  created_at timestamptz not null default now(),
  primary key (note_id, file_id)
);

create table note_embeddings (
  note_id     uuid primary key references notes(id) on delete cascade,
  embedding   vector(1536)
);
create index on note_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 6) Dossiers / Documentation
create table folders (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  parent_id   uuid references folders(id) on delete cascade,
  name        text not null,
  scope       text not null default 'generic' check (scope in ('client','project','generic','fundraising','product','tech','team')),
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on folders (account_id, parent_id);
create trigger trg_folders_updated_at
before update on folders
for each row execute function set_updated_at();

create table files (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete cascade,
  folder_id        uuid references folders(id) on delete set null,
  kind             text not null check (kind in ('upload','link','doc_internal','note_ref')),
  name             text not null,
  ext              text,
  size             bigint,
  mime             text,
  storage_path     text,
  external_url     text,
  meta             jsonb not null default '{}',
  current_version_id uuid,
  created_by       uuid references app_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on files (account_id, folder_id, kind);
create trigger trg_files_updated_at
before update on files
for each row execute function set_updated_at();

create table file_versions (
  id            uuid primary key default gen_random_uuid(),
  file_id       uuid not null references files(id) on delete cascade,
  version_no    int not null,
  storage_path  text,
  external_url  text,
  checksum      text,
  author_id     uuid references app_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on file_versions (file_id, version_no);

alter table files
  add constraint files_current_version_fk
  foreign key (current_version_id) references file_versions(id) on delete set null;

create table file_shares (
  file_id      uuid references files(id) on delete cascade,
  subject_type text not null check (subject_type in ('user','client','role')),
  subject_id   uuid,
  permission   text not null check (permission in ('read','comment','edit','download')),
  primary key (file_id, subject_type, subject_id)
);

create table file_embeddings (
  file_id     uuid primary key references files(id) on delete cascade,
  embedding   vector(1536)
);
create index on file_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 7) Emails (Gmail)
create table mail_accounts (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  provider       text not null default 'gmail' check (provider in ('gmail')),
  email_address  text not null,
  oauth_tokens   jsonb not null default '{}',
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on mail_accounts (account_id, provider, email_address);
create trigger trg_mail_accounts_updated_at
before update on mail_accounts
for each row execute function set_updated_at();

create table emails (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  mail_account_id uuid not null references mail_accounts(id) on delete cascade,
  thread_id       text,
  message_id      text,
  direction       text not null check (direction in ('in','out')),
  subject         text,
  snippet         text,
  body_text       text,
  body_html       text,
  headers         jsonb not null default '{}',
  "from"          text,
  "to"            text[],
  cc              text[],
  bcc             text[],
  date            timestamptz,
  client_id       uuid references clients(id) on delete set null,
  project_id      uuid references projects(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on emails (account_id, mail_account_id, date desc);
create index on emails using gin (to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(snippet,'') || ' ' || coalesce(body_text,'')));

create table email_attachments (
  id          uuid primary key default gen_random_uuid(),
  email_id    uuid not null references emails(id) on delete cascade,
  file_id     uuid references files(id) on delete set null,
  filename    text,
  size        bigint,
  mime        text
);

-- 8) Produit & Roadmap
create table products (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  type        text not null check (type in ('physical','digital')),
  name        text not null,
  sku         text,
  cost        numeric(14,2),
  meta        jsonb not null default '{}',
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on products (account_id, type, name);
create trigger trg_products_updated_at
before update on products
for each row execute function set_updated_at();

create table product_integrations (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  provider    text not null check (provider in ('shopify','woocommerce')),
  creds       jsonb not null default '{}',
  status      text not null default 'inactive',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on product_integrations (account_id, provider);
create trigger trg_product_integrations_updated_at
before update on product_integrations
for each row execute function set_updated_at();

create table features (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  project_id  uuid references projects(id) on delete set null,
  title       text not null,
  description text,
  status      text not null default 'backlog' check (status in ('backlog','planned','in_progress','done','cancelled')),
  priority    int,
  effort      int,
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on features (account_id, project_id, status);
create trigger trg_features_updated_at
before update on features
for each row execute function set_updated_at();

create table roadmaps (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  horizon     text,
  strategy    jsonb not null default '{}',
  created_by  uuid references app_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on roadmaps (account_id, horizon);
create trigger trg_roadmaps_updated_at
before update on roadmaps
for each row execute function set_updated_at();

create table roadmap_items (
  id           uuid primary key default gen_random_uuid(),
  roadmap_id   uuid not null references roadmaps(id) on delete cascade,
  feature_id   uuid references features(id) on delete set null,
  title        text not null,
  start_date   date,
  end_date     date,
  status       text not null default 'planned' check (status in ('planned','in_progress','done','blocked')),
  rice         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on roadmap_items (roadmap_id, status);
create trigger trg_roadmap_items_updated_at
before update on roadmap_items
for each row execute function set_updated_at();

-- 9) RLS (Row Level Security) - Enable on all tables
alter table accounts          enable row level security;
alter table app_users         enable row level security;
alter table invitations       enable row level security;
alter table clients           enable row level security;
alter table projects          enable row level security;
alter table deals             enable row level security;
alter table activities        enable row level security;
alter table notes             enable row level security;
alter table note_links        enable row level security;
alter table tags              enable row level security;
alter table note_tags         enable row level security;
alter table note_versions     enable row level security;
alter table note_shares       enable row level security;
alter table note_files        enable row level security;
alter table note_embeddings   enable row level security;
alter table folders           enable row level security;
alter table files             enable row level security;
alter table file_versions     enable row level security;
alter table file_shares       enable row level security;
alter table file_embeddings   enable row level security;
alter table mail_accounts     enable row level security;
alter table emails            enable row level security;
alter table email_attachments enable row level security;
alter table products          enable row level security;
alter table product_integrations enable row level security;
alter table features          enable row level security;
alter table roadmaps          enable row level security;
alter table roadmap_items     enable row level security;

-- 10) RLS Policies - Basic multi-tenant policies
-- SELECT policies (read access)
create policy p_select_same_account on accounts
for select using ( id = current_account_id() );

create policy p_select_app_users_same_account on app_users
for select using ( account_id = current_account_id() );

create policy p_select_same_account_clients on clients
for select using ( account_id = current_account_id() );

create policy p_select_same_account_projects on projects
for select using ( account_id = current_account_id() );

create policy p_select_same_account_deals on deals
for select using ( account_id = current_account_id() );

create policy p_select_same_account_activities on activities
for select using ( account_id = current_account_id() );

create policy p_select_same_account_notes on notes
for select using (
  account_id = current_account_id()
  or (visibility = 'client_ro' and current_role() = 'client_viewer')
);

create policy p_select_same_account_folders on folders
for select using ( account_id = current_account_id() );

create policy p_select_same_account_files on files
for select using ( account_id = current_account_id() );

create policy p_select_same_account_tags on tags
for select using ( account_id = current_account_id() );

create policy p_select_same_account_mail on mail_accounts
for select using ( account_id = current_account_id() );

create policy p_select_same_account_emails on emails
for select using ( account_id = current_account_id() );

create policy p_select_same_account_products on products
for select using ( account_id = current_account_id() );

create policy p_select_same_account_features on features
for select using ( account_id = current_account_id() );

create policy p_select_same_account_roadmaps on roadmaps
for select using ( account_id = current_account_id() );

-- WRITE policies (insert/update/delete) - owner & collaborator only
create policy p_write_clients on clients
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_projects on projects
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_deals on deals
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_notes on notes
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_folders on folders
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_files on files
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_tags on tags
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

create policy p_write_mail on mail_accounts
for all using ( account_id = current_account_id() and current_role() in ('owner','collaborator') )
with check ( account_id = current_account_id() );

-- 11) Additional search indexes (trigram for fuzzy search)
create index if not exists idx_clients_trgm on clients using gin (name gin_trgm_ops);
create index if not exists idx_projects_trgm on projects using gin (name gin_trgm_ops);
create index if not exists idx_notes_trgm on notes using gin (title gin_trgm_ops);
create index if not exists idx_files_trgm on files using gin (name gin_trgm_ops);
