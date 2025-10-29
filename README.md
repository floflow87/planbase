# 🚀 Planbase - Modular SaaS Platform

Comprehensive modular SaaS platform for freelancers and startup creators with multi-account management, CRM, AI-powered notes, file management, and roadmap planning.

## ✨ Features

### 🏢 Multi-Tenant Architecture
- Account management with RLS (Row-Level Security)
- User roles: Owner, Collaborator, Client Viewer
- Team invitations with expiration tokens

### 👥 CRM & Pipeline Management
- Client management (companies & individuals)
- Projects with stages and budgets
- Deals pipeline with probability tracking
- Activity timeline (emails, calls, meetings, notes)

### 📝 AI-Powered Notes (Notion-like)
- Rich content blocks editor
- GPT-5 powered summaries
- Whisper audio transcription
- Semantic search with pgvector embeddings
- Version history & collaboration sharing

### 📁 File Management
- Hierarchical folder structure
- Version control with checksums
- Granular sharing permissions
- Document semantic search

### 📧 Email Integration
- Gmail OAuth connection
- Full email storage & threading
- Attachment management

### 📦 Product & Roadmap
- Product catalog (physical/digital)
- Shopify/WooCommerce integrations
- Feature backlog with RICE scoring
- Strategic roadmap planning

## 🛠️ Tech Stack

### Frontend
- **React** + TypeScript
- **Wouter** - Routing
- **TanStack Query** - Data fetching
- **shadcn/ui** + Tailwind CSS - UI Components
- **Buddy Design System** - Poppins/Inter fonts, Violet/Cyan/Green palette

### Backend
- **Express** + TypeScript
- **Drizzle ORM** - Type-safe database queries
- **Supabase PostgreSQL** - Database with RLS & pgvector
- **OpenAI API** - GPT-5, Whisper, text-embedding-ada-002

### Database
- **Supabase PostgreSQL**
- **28 tables** with complete multi-tenant schema
- **pgvector** extension for AI embeddings (1536 dimensions)
- **RLS policies** for secure multi-tenant access
- **Triggers** for automatic timestamps

## 📦 Installation

### Prerequisites
- Node.js 20+
- Supabase account
- OpenAI API key

### Environment Variables
Create these secrets in your Replit workspace:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_PASSWORD=your-database-password
OPENAI_API_KEY=your-openai-key
SESSION_SECRET=your-session-secret
```

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Deploy database schema**
   ```bash
   tsx scripts/push-to-supabase.ts
   ```

3. **Seed demo data**
   ```bash
   curl -X POST http://localhost:5000/api/seed
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Schema

**Complete multi-tenant architecture with 28 tables:**

- **Core**: accounts, app_users, invitations
- **CRM**: clients, deals, projects, activities
- **Notes**: notes, note_links, note_tags, note_versions, note_shares, note_files, note_embeddings, tags
- **Files**: files, folders, file_versions, file_shares, file_embeddings
- **Email**: emails, email_attachments, mail_accounts
- **Product**: products, product_integrations, features, roadmaps, roadmap_items

All tables include:
- `account_id` for multi-tenancy
- RLS policies for secure access
- Automatic `created_at` / `updated_at` timestamps

## 🚀 Deployment

### Replit Deployment
1. Click **"Publish"** in Replit
2. Choose **Autoscale** or **Reserved VM**
3. Configure environment variables
4. Deploy!

### Custom Domain (OVH)
1. Get DNS records from Replit Deployments → Settings
2. Add A record and TXT record in OVH DNS zone
3. Wait 1-2 hours for DNS propagation
4. SSL/TLS certificate auto-generated

## 📚 Documentation

- `replit.md` - Complete project overview
- `DNS-CONFIGURATION-OVH.md` - OVH DNS setup guide
- `shared/schema.ts` - Complete Drizzle schema
- `supabase-schema.sql` - Raw SQL schema (542 lines)

## 🤝 Contributing

This is a private project for [Your Name/Company]. 

## 📝 License

Private - All Rights Reserved

## 🎯 Current Status

### ✅ Completed
- Database migration to Supabase (28 tables)
- Demo data seeding
- Storage layer & API routes (accounts, users, clients, projects, notes, files)
- Buddy design system implementation

### ⚠️ In Progress
- Authentication middleware (security)
- Complete API coverage (deals, pipeline, emails, products)
- Frontend adaptation to Supabase schema

---

Built with ❤️ using React, Express, Supabase, and OpenAI
