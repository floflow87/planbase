-- ============================================
-- Add document_templates and documents tables
-- Execute this SQL in Supabase SQL Editor
-- ============================================

-- 1) Create document_templates table
create table document_templates (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid references accounts(id) on delete cascade,
  name             text not null,
  description      text,
  category         text not null default 'legal' check (category in ('legal','contract','creative','business')),
  icon             text default 'FileText',
  is_system        int not null default 0 check (is_system in (0,1)),
  form_schema      jsonb not null default '[]',
  content_template text not null,
  created_by       uuid references app_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on document_templates (account_id, category);
create trigger trg_document_templates_updated_at
before update on document_templates
for each row execute function set_updated_at();

-- 2) Create documents table
create table documents (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  template_id uuid references document_templates(id) on delete set null,
  created_by  uuid not null references app_users(id) on delete set null,
  title       text not null default '',
  content     jsonb not null default '[]',
  plain_text  text,
  status      text not null default 'draft' check (status in ('draft','review','signed','archived')),
  metadata    jsonb not null default '{}',
  visibility  text not null default 'private' check (visibility in ('private','account','client_ro')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  signed_at   timestamptz
);

create index on documents (account_id, status);
create index on documents (template_id);
create index documents_fts_idx on documents using gin (to_tsvector('simple', coalesce(plain_text,'')));
create trigger trg_documents_updated_at
before update on documents
for each row execute function set_updated_at();

-- 3) Create document_links table
create table document_links (
  document_id uuid references documents(id) on delete cascade,
  target_type text not null check (target_type in ('project','client','deal')),
  target_id   uuid not null,
  primary key (document_id, target_type, target_id)
);
create index on document_links (target_type, target_id);

-- 4) Create document_shares table
create table document_shares (
  document_id  uuid references documents(id) on delete cascade,
  subject_type text not null check (subject_type in ('user','client','role')),
  subject_id   uuid not null,
  permission   text not null check (permission in ('read','comment','edit')),
  primary key (document_id, subject_type, subject_id)
);

-- 5) Enable RLS
alter table document_templates enable row level security;
alter table documents enable row level security;
alter table document_links enable row level security;
alter table document_shares enable row level security;

-- 6) RLS Policies for document_templates

-- SELECT: Users can see system templates (account_id is null) OR templates from their account
create policy p_select_document_templates on document_templates
for select using (
  is_system = 1 
  or account_id = current_account_id()
);

-- INSERT/UPDATE/DELETE: Only for account-specific templates (not system templates)
create policy p_write_document_templates on document_templates
for all using (
  account_id = current_account_id() 
  and current_user_role() in ('owner','collaborator')
  and is_system = 0
)
with check (
  account_id = current_account_id()
  and is_system = 0
);

-- 7) RLS Policies for documents

-- SELECT: Users can see documents from their account
create policy p_select_documents on documents
for select using (
  account_id = current_account_id()
  or (visibility = 'client_ro' and current_user_role() = 'client_viewer')
);

-- WRITE: Owner & collaborator can create/update/delete documents
create policy p_write_documents on documents
for all using (
  account_id = current_account_id() 
  and current_user_role() in ('owner','collaborator')
)
with check (
  account_id = current_account_id()
);

-- 8) RLS Policies for document_links
create policy p_all_document_links on document_links
for all using (
  exists (
    select 1 from documents d
    where d.id = document_links.document_id
    and d.account_id = current_account_id()
  )
);

-- 9) RLS Policies for document_shares
create policy p_all_document_shares on document_shares
for all using (
  exists (
    select 1 from documents d
    where d.id = document_shares.document_id
    and d.account_id = current_account_id()
  )
);

-- 10) Add trigram index for fuzzy search
create index if not exists idx_documents_trgm on documents using gin (title gin_trgm_ops);
