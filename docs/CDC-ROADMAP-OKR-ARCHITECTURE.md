# CDC / Roadmap / OKR System Architecture

## Overview

This document outlines the comprehensive system architecture for the integrated CDC (Cahier des Charges), Roadmap, and OKR management features in PlanBase. This specification is intended for future implementation.

## 1. CDC (Cahier des Charges) Module

### Purpose
The CDC module serves as the central documentation hub for project specifications, requirements tracking, and technical documentation.

### Core Features
- **Document Management**: Rich text editing with versioning
- **Requirements Tracking**: Hierarchical requirement structure with traceability
- **Validation Workflow**: Status tracking (draft, review, approved, implemented)
- **Cross-linking**: Connect CDC items to tasks, sprints, and roadmap items

### Data Model
```typescript
interface CDCDocument {
  id: string;
  projectId: string;
  title: string;
  version: string;
  status: 'draft' | 'review' | 'approved' | 'implemented';
  content: object; // Rich text JSON
  requirements: CDCRequirement[];
  createdAt: Date;
  updatedAt: Date;
}

interface CDCRequirement {
  id: string;
  cdcDocumentId: string;
  parentId?: string;
  code: string; // REQ-001, REQ-002
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  status: 'pending' | 'in_progress' | 'implemented' | 'verified';
  linkedTaskIds: string[];
  linkedRoadmapItemIds: string[];
}
```

## 2. Roadmap Module

### Purpose
Strategic product planning with timeline visualization, milestone tracking, and feature prioritization.

### Core Features
- **Timeline View**: Gantt-style visualization with drag-and-drop
- **Milestone Management**: Key deliverables and deadlines
- **Feature Planning**: Epics and features with RICE scoring
- **Dependency Tracking**: Cross-feature dependencies
- **OKR Integration**: Link roadmap items to objectives

### Data Model
```typescript
interface RoadmapItem {
  id: string;
  projectId: string;
  type: 'milestone' | 'epic' | 'feature' | 'initiative';
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'in_progress' | 'completed' | 'blocked';
  riceScore: {
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    score: number;
  };
  parentId?: string;
  dependencies: string[];
  linkedOkrIds: string[];
  linkedCdcRequirementIds: string[];
  color: string;
  progress: number;
}
```

### Views
1. **Timeline View**: Horizontal timeline with items as bars
2. **Board View**: Kanban-style organization by status
3. **Tree View**: Hierarchical view of epics/features
4. **Table View**: Sortable, filterable list

## 3. OKR (Objectives and Key Results) Module

### Purpose
Goal-setting framework to align product development with business objectives.

### Core Features
- **Objective Management**: Company, team, and individual objectives
- **Key Results Tracking**: Measurable outcomes with progress tracking
- **Cascading Goals**: Parent-child objective relationships
- **Alignment View**: Visualize how work connects to objectives
- **Progress Dashboard**: Real-time OKR progress metrics

### Data Model
```typescript
interface Objective {
  id: string;
  projectId?: string;
  parentId?: string;
  title: string;
  description: string;
  level: 'company' | 'team' | 'individual';
  period: {
    startDate: Date;
    endDate: Date;
  };
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  keyResults: KeyResult[];
  progress: number;
  linkedRoadmapItemIds: string[];
}

interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  metricType: 'number' | 'percentage' | 'currency' | 'boolean';
  startValue: number;
  targetValue: number;
  currentValue: number;
  progress: number;
  status: 'on_track' | 'at_risk' | 'behind';
  linkedTaskIds: string[];
}
```

### Scoring System
- **0-0.3**: Did not achieve (red)
- **0.4-0.6**: Made progress (yellow)
- **0.7-1.0**: Achieved or exceeded (green)

## 4. Integration Architecture

### Cross-Module Linking

```
                    ┌─────────────────┐
                    │      OKR        │
                    │   Objectives    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌─────────┐    ┌──────────┐    ┌─────────┐
        │ Roadmap │◄──►│   CDC    │◄──►│  Tasks  │
        │  Items  │    │  Reqs    │    │ (Kanban)│
        └─────────┘    └──────────┘    └─────────┘
```

### Traceability Matrix
- **OKR → Roadmap**: Link objectives to strategic initiatives
- **Roadmap → CDC**: Connect features to requirements
- **CDC → Tasks**: Map requirements to implementation tasks
- **Tasks → OKR**: Roll up task completion to key results

### API Endpoints (Future)
```
GET    /api/projects/:id/cdc
POST   /api/projects/:id/cdc
GET    /api/projects/:id/cdc/:cdcId/requirements
POST   /api/projects/:id/cdc/:cdcId/requirements

GET    /api/projects/:id/roadmap
POST   /api/projects/:id/roadmap/items
PATCH  /api/projects/:id/roadmap/items/:itemId
DELETE /api/projects/:id/roadmap/items/:itemId

GET    /api/projects/:id/okrs
POST   /api/projects/:id/okrs
GET    /api/projects/:id/okrs/:okrId/key-results
POST   /api/projects/:id/okrs/:okrId/key-results
PATCH  /api/projects/:id/okrs/:okrId/key-results/:krId
```

## 5. Database Schema Extensions

### Tables to Add
1. `cdc_documents` - CDC documents
2. `cdc_requirements` - Requirements with hierarchy
3. `cdc_requirement_links` - Links to tasks/roadmap
4. `roadmap_items` - Roadmap items
5. `roadmap_dependencies` - Item dependencies
6. `okr_objectives` - Objectives
7. `okr_key_results` - Key results
8. `okr_links` - Links between OKRs and other entities

### Indexes
- Full-text search on CDC content
- Date range queries for roadmap
- Parent-child traversal for hierarchy

## 6. UI Components

### CDC Module
- `CDCEditor` - Rich text editor with requirements embedding
- `RequirementTree` - Hierarchical requirement browser
- `RequirementCard` - Individual requirement with links
- `CDCVersionHistory` - Version comparison view

### Roadmap Module
- `RoadmapTimeline` - Gantt-style timeline
- `RoadmapBoard` - Kanban view
- `RoadmapItemForm` - Create/edit form with RICE scoring
- `DependencyGraph` - Visualize item dependencies

### OKR Module
- `OKRDashboard` - Overview with progress rings
- `ObjectiveCard` - Objective with key results
- `KeyResultProgress` - Progress bar with metrics
- `AlignmentTree` - Cascading goal visualization

## 7. Implementation Phases

### Phase 1: Foundation
1. Database schema creation
2. Basic CRUD APIs
3. Simple list views

### Phase 2: Core Features
1. Rich CDC editor
2. Roadmap timeline view
3. OKR progress tracking

### Phase 3: Integration
1. Cross-module linking
2. Traceability matrix
3. Alignment reports

### Phase 4: Advanced
1. AI-powered suggestions
2. Automated progress updates
3. Export/import capabilities

## 8. Technical Considerations

### Performance
- Lazy loading for large CDC documents
- Virtual scrolling for long roadmap timelines
- Cached OKR calculations

### Security
- RLS policies for multi-tenant access
- Audit trail for CDC changes
- Role-based permissions for OKR updates

### Scalability
- Pagination for list endpoints
- Background jobs for progress calculations
- CDN caching for exported documents

---

*Last Updated: January 2026*
*Status: Future Implementation Specification*
