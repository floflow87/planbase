# Planbase - Modular SaaS Platform

## Project Overview
Planbase is a comprehensive modular SaaS platform for freelancers and startup creators. Features include multi-account management with RLS, CRM with pipeline tracking, AI-powered notes (GPT-5 summaries, Whisper transcription, semantic search with pgvector), file management with versioning, Gmail integration, product management, and roadmap planning.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter (routing), TanStack Query (data fetching), shadcn/ui + Tailwind CSS
- **Backend**: Express + TypeScript, Drizzle ORM
- **Database**: **Supabase PostgreSQL** (with RLS, Auth, Storage, pgvector)
- **AI**: OpenAI API (GPT-5 summaries, Whisper transcription, text-embedding-ada-002 for semantic search)
- **Design System**: Buddy (Poppins/Inter fonts, Violet #7C3AED primary, Cyan #06B6D4 accent, Green #10B981 success)

## Database Architecture (Supabase)

### Migration from Neon to Supabase ✅ COMPLETED
- **CRITICAL**: This project now uses **Supabase exclusively** - no more Neon
- Connection via `postgres-js` library
- Session pooler: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-eu-north-1.pooler.supabase.com:5432/postgres`
- **28 tables created successfully** with complete schema (accounts, CRM, notes, files, emails, products, roadmaps)
- **Demo data seeded** successfully with account, users, clients, projects, notes

### Complete Schema (542 lines SQL)
Multi-tenant architecture with comprehensive data models in `shared/schema.ts` and `supabase-schema.sql`:

#### Core Tables
- **accounts** - Multi-tenant account management
- **app_users** - User profiles mapped to Supabase Auth (auth.users.id)
- **invitations** - Team invitation system with tokens

#### CRM & Pipeline
- **clients** - Client management (company/person, contacts array, tags, budget)
- **projects** - Projects linked to clients with stages
- **deals** - Sales pipeline with probability, value, close dates
- **activities** - Audit log (emails, calls, meetings, notes, tasks, files)

#### Notes System (Notion-like)
- **notes** - Rich content blocks, AI summaries, visibility controls
- **note_links** - Links to projects, tasks, files, clients
- **tags** - Shared tag system across notes
- **note_tags** - Many-to-many note-tag relations
- **note_versions** - Version history with content snapshots
- **note_shares** - Granular sharing (user/client/role based)
- **note_files** - Attachments linking
- **note_embeddings** - pgvector(1536) for semantic search

#### File Management
- **folders** - Hierarchical folder structure with scopes
- **files** - File metadata (upload/link/doc_internal/note_ref types)
- **file_versions** - Version control with checksums
- **file_shares** - Sharing permissions (read/comment/edit/download)
- **file_embeddings** - pgvector for document semantic search

#### Email Integration (Gmail)
- **mail_accounts** - OAuth Gmail account connections
- **emails** - Full email storage (thread_id, headers, body_text/html, attachments)
- **email_attachments** - File references for email attachments

#### Product & Roadmap
- **products** - Product catalog (physical/digital, SKU, cost)
- **product_integrations** - Shopify/WooCommerce integrations
- **features** - Feature backlog with priority/effort scores
- **roadmaps** - Strategic planning with horizons (Q1, Q2, etc.)
- **roadmap_items** - Roadmap entries with RICE scoring

### Row Level Security (RLS)
All tables have RLS enabled with policies:
- **SELECT**: `account_id = current_account_id()`
- **WRITE**: `current_user_role() in ('owner','collaborator')`
- **Shared content**: Special policies for notes/files with visibility controls

### Helper Functions
```sql
current_account_id()   -- Returns UUID from JWT claim
current_user_role()    -- Returns 'owner'|'collaborator'|'client_viewer'
set_updated_at()       -- Trigger function for updated_at timestamps
```

### Extensions Enabled
- `pgcrypto` - UUID generation
- `uuid-ossp` - Additional UUID functions
- `pg_trgm` - Fuzzy text search (trigram indexes)
- `vector` - pgvector for AI embeddings (1536 dimensions)

## Environment Variables

Required Supabase secrets (configured):
- `SUPABASE_URL` - https://gfftezyrhsxtaeceuszd.supabase.co
- `SUPABASE_ANON_KEY` - Public anon key for client-side requests
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server-side operations
- `SUPABASE_DB_PASSWORD` - Direct PostgreSQL connection password
- `OPENAI_API_KEY` - OpenAI API for GPT-5, Whisper, embeddings
- `SESSION_SECRET` - Express session encryption

## Setup Instructions

### 1. Initialize Supabase Database
Execute the complete SQL schema in Supabase SQL Editor:
```bash
# File: supabase-schema.sql (542 lines)
# This creates all tables, indexes, RLS policies, triggers, and helper functions
```

Or use Drizzle to push schema (after manual table cleanup):
```bash
npm run db:push --force
```

### 2. Enable pgvector Extension
In Supabase dashboard:
1. Go to Database → Extensions
2. Enable "vector" extension
3. Or run: `create extension if not exists vector;`

### 3. Seed Demo Data
```bash
# Call the seed endpoint (TODO: needs update for new schema)
curl -X POST http://localhost:5000/api/seed
```

## OpenAI Integration (server/lib/openai.ts)

AI-powered features using OpenAI API:
- **Text Summarization**: GPT-5 powered summaries for notes
- **Action Extraction**: Detect action items from meeting notes
- **Audio Transcription**: Whisper API for voice notes
- **Semantic Search**: text-embedding-ada-002 for vector embeddings
- **Document Classification**: Intelligent categorization
- **CRM Suggestions**: AI-driven next action recommendations

## Frontend Pages (Buddy Design System)

All UI components follow `design_guidelines.md`:

### Dashboard (`client/src/pages/dashboard.tsx`)
- Real-time KPI cards (clients, projects, revenue, tasks)
- Revenue chart with monthly trends
- Recent projects with progress bars
- Activity feed
- **Status**: ✅ Connected to API

### CRM (`client/src/pages/crm.tsx`)
- Client table with status badges
- Filters and search
- New client form with validation
- **Status**: ✅ Fully integrated with API

### Projects & To-Do (`client/src/pages/projects.tsx`)
- Kanban board (To Do, In Progress, Review, Done)
- Task creation with full form
- **Status**: ⚠️ Needs migration to new schema

### Notes (`client/src/pages/notes.tsx`)
- Note list with categories
- AI suggestions panel
- **Status**: ⚠️ Needs migration to new schema

### Documents (`client/src/pages/documents.tsx`)
- Tree-view folder navigation
- File grid with icons
- **Status**: ⚠️ Needs migration to new schema

### Coming Soon Pages
- Roadmap (`client/src/pages/roadmap.tsx`)
- Product (`client/src/pages/product.tsx`)
- Marketing, Finance, Commercial, Legal

## Deployment & DNS Configuration

### Publishing on Replit
1. Click "Publish" button in workspace
2. Choose deployment type:
   - **Autoscale** (recommended for SaaS)
   - **Reserved VM** (guaranteed resources)
3. Get DNS records (A and TXT) from Deployments → Settings

### DNS Configuration for OVH
See complete guide: `DNS-CONFIGURATION-OVH.md`

**Quick steps**:
1. Add **A record**: `@` → Replit IP address
2. Add **TXT record**: `@` → `replit-verification=...`
3. Add **A record for www**: `www` → Same Replit IP
4. Wait 1-2 hours for DNS propagation
5. Replit auto-generates SSL/TLS certificate

## Key Files

### Backend
- `server/db.ts` - Supabase PostgreSQL connection
- `server/storage.ts` - Database abstraction layer (needs update)
- `server/routes.ts` - API endpoints (needs migration)
- `server/lib/openai.ts` - OpenAI utilities

### Schema & Database
- `shared/schema.ts` - Complete Drizzle schema (TypeScript)
- `supabase-schema.sql` - Complete SQL schema (542 lines)
- `drizzle.config.ts` - Drizzle configuration

### Frontend
- `client/src/App.tsx` - Main app with routing
- `client/src/pages/*` - All page components
- `client/src/components/app-sidebar.tsx` - Navigation
- `design_guidelines.md` - Buddy design system

### Documentation
- `replit.md` - This file (project overview)
- `DNS-CONFIGURATION-OVH.md` - DNS setup guide
- `attached_assets/Pasted--0-Extensions--1761733668714_1761733668714.txt` - Original SQL schema

## Current State (Oct 29, 2025)

### ✅ Completed
- ✅ **Supabase database fully configured** (Session pooler IPv4: aws-1-eu-north-1)
- ✅ **Complete schema deployed** (28 tables with RLS, triggers, pgvector)
- ✅ **Demo data seeded** (Demo Startup account, 2 users, 3 clients, 3 projects)
- ✅ **Script created**: `scripts/push-to-supabase.ts` for schema deployment
- ✅ OpenAI integration ready
- ✅ Buddy design system implemented
- ✅ DNS deployment guide created

### ⚠️ In Progress
- Update storage layer (`server/storage.ts`) to use new Supabase schema
- Update API routes (`server/routes.ts`) for all tables
- Migrate frontend pages to fetch from new API endpoints
- Implement Supabase Auth integration
- Create embeddings for semantic search (pgvector ready)

### 🔜 Planned
- Authentication with Supabase Auth
- File upload to Supabase Storage
- Real-time collaboration (Supabase Realtime)
- Email sync with Gmail API
- Advanced semantic search with pgvector
- Roadmap and product management features

## Development Commands

```bash
# Start development server
npm run dev

# Push schema to Supabase
npm run db:push --force

# Generate Drizzle migrations (not recommended - use db:push)
npm run db:generate

# Open Drizzle Studio (database viewer)
npm run db:studio
```

## Notes for Developers

1. **Always use Supabase** - No Neon references
2. **RLS is enabled** - All queries filtered by account_id automatically
3. **Use service_role_key** for server-side operations (bypasses RLS)
4. **pgvector dimensions**: 1536 (OpenAI text-embedding-ada-002)
5. **JWT claims required**: `account_id` and `role` in auth.jwt()
6. **Buddy design system**: Follow `design_guidelines.md` strictly

## Architecture Decisions

- **Multi-tenancy**: account_id on all tables with RLS
- **Soft deletes**: Not implemented (use status/visibility fields)
- **Versioning**: Explicit version tables (note_versions, file_versions)
- **Search**: Dual approach (trigram for fuzzy, pgvector for semantic)
- **File storage**: Supabase Storage with metadata in PostgreSQL
- **Real-time**: Prepared for Supabase Realtime subscriptions

The foundation is enterprise-ready with Supabase architecture!
