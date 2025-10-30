# Planbase - Modular SaaS Platform

## Overview
Planbase is a comprehensive modular SaaS platform designed for freelancers and startup creators. Its core purpose is to streamline business operations through features like multi-account management with Row Level Security (RLS), a CRM with pipeline tracking, AI-powered notes (summarization, transcription, semantic search), file management with versioning, Gmail integration, and robust product and roadmap planning tools. The platform aims to provide an all-in-one solution for managing client relationships, projects, and internal knowledge, leveraging AI to enhance productivity and organization.

## User Preferences
- I prefer simple language and clear explanations.
- I like iterative development with regular updates.
- Please ask for confirmation before implementing major changes or refactoring significant portions of the codebase.
- I prefer detailed explanations for complex architectural decisions or new feature implementations.
- Do not make changes to the `replit.md` file itself.

## System Architecture
Planbase is built on a modern full-stack architecture using **React + TypeScript** for the frontend, **Express + TypeScript** for the backend, and **Supabase PostgreSQL** as the primary database.

**UI/UX Decisions (Buddy Design System):**
- Uses `shadcn/ui` and `Tailwind CSS` for a consistent and responsive design.
- Typography: Poppins and Inter fonts.
- Color Palette: Violet (`#7C3AED`) as primary, Cyan (`#06B6D4`) as accent, Green (`#10B981`) for success states.
- All UI components adhere to `design_guidelines.md`.

**Technical Implementations:**
- **Frontend:** `Wouter` for routing, `TanStack Query` for data fetching.
- **Database:** Supabase PostgreSQL with extensive use of RLS, Supabase Auth, Supabase Storage, and the `pgvector` extension for AI embeddings. The schema (`supabase-schema.sql` and `shared/schema.ts`) supports multi-tenancy with 28 core tables for CRM, notes, files, emails, tasks, products, and roadmaps.
- **Multi-tenancy:** Implemented with `account_id` on all tables and enforced via RLS policies.
- **AI Integration:** Utilizes OpenAI API for GPT-5 (summaries, action extraction), Whisper (audio transcription), and `text-embedding-ada-002` (semantic search embeddings).
- **Task Management:** Features a fully implemented Kanban system with drag-and-drop functionality for tasks and columns using `@dnd-kit`. Includes customizable columns, inline editing, and real-time position updates.
- **File Management:** Supports hierarchical folders, file versioning, and sharing permissions.
- **Search:** Employs `pg_trgm` for fuzzy text search and `pgvector` for semantic search.
- **Security (Development State):** Current authentication is header-based and for development only. Production will require full Supabase Auth JWT verification, signature validation, session management, and refresh token rotation.

**Feature Specifications:**
- **CRM:** Client management, project tracking, deal pipelines, and activity logging.
- **Notes:** Rich content notes with AI summaries, versioning, sharing, and semantic search.
- **Files:** Version-controlled file storage with metadata, sharing, and semantic search capabilities.
- **Email:** Gmail integration for storing and managing emails and attachments.
- **Tasks:** Kanban and List views with drag-and-drop, customizable columns, and detailed task management.
- **Product/Roadmap:** Product catalog, feature backlog, and strategic roadmap planning with RICE scoring.

## External Dependencies
- **Supabase:**
  - **PostgreSQL Database:** Primary data store, including RLS, Auth, and Storage.
  - **`pgvector` Extension:** For AI embeddings and semantic search (1536 dimensions).
  - **`pg_trgm` Extension:** For fuzzy text search.
  - **`pgcrypto` & `uuid-ossp` Extensions:** For UUID generation.
- **OpenAI API:**
  - **GPT-5:** Text summarization, action extraction, CRM suggestions.
  - **Whisper API:** Audio transcription for voice notes.
  - **`text-embedding-ada-002`:** For generating vector embeddings for semantic search.
- **Gmail API:** For email integration and synchronization.