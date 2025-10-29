# Planbase Design Guidelines - Design System "Buddy"

## Design Approach
**System-Based Approach**: This project follows a complete custom design system called "Buddy" with established visual language, components, and interactions specifically designed for a SaaS productivity platform.

## Core Design Elements

### A. Color Palette (Design System Buddy)

**Primary Colors:**
- Primary Violet: `#7C3AED` - Main brand color, primary actions, navigation highlights
- Secondary Purple: `#A855F7` - Secondary actions, hover states
- Accent Cyan: `#06B6D4` - Interactive elements, links, secondary highlights

**Semantic Colors:**
- Success Green: `#10B981` - Positive indicators, success states, revenue increases
- Warning Orange: `#F59E0B` - Medium priority, warnings
- Error Red: `#EF4444` - High priority, errors, urgent items

**Neutral Scale:**
- Light backgrounds: `#FFFFFF`, `#F9FAFB`, `#F3F4F6`
- Borders: `#E5E7EB`, `#D1D5DB`
- Text: `#111827` (headings), `#6B7280` (body), `#9CA3AF` (muted)

### B. Typography

**Font Families:**
- Headings: **Poppins** (600 SemiBold for emphasis)
- Body Text: **Inter** (400 Regular, 500 Medium, 600 SemiBold)

**Type Scale:**
- Hero/Dashboard Title: 32px-36px, Poppins SemiBold
- Page Headers: 24px-28px, Poppins SemiBold
- Section Titles: 18px-20px, Poppins SemiBold
- Card Titles: 16px, Inter SemiBold
- Body Text: 14px-16px, Inter Regular
- Small Labels: 12px-14px, Inter Medium
- Micro Text (metadata): 12px, Inter Regular, text-gray-500

### C. Layout System

**Spacing Units (Tailwind):**
- Micro spacing: `p-2`, `gap-2` (8px)
- Standard spacing: `p-4`, `gap-4` (16px), `p-6`, `gap-6` (24px)
- Section spacing: `p-8` (32px), `py-12` (48px)
- Page margins: `px-6` to `px-8`

**Grid Structures:**
- Dashboard KPI Cards: 4-column grid on desktop (`grid-cols-4`)
- CRM Table: Full-width responsive table
- Documents: Grid view 4-6 items per row or list view
- Notes: List view with 2-column metadata layout

**Container Widths:**
- Main content area: `max-w-7xl` with sidebar
- Sidebar: Fixed `w-64` (256px)
- Content with sidebar: `calc(100vw - 256px - padding)`

### D. Component Library

**Sidebar Navigation:**
- Fixed left sidebar, 256px width
- Logo at top (PlanBase with violet accent)
- Sections with icons and labels
- Active state: violet background (`bg-violet-100`), violet text
- Hover: subtle gray background (`bg-gray-50`)
- User profile at bottom with avatar and role badge

**KPI Cards:**
- White background with subtle shadow (`shadow-sm`)
- Rounded corners (`rounded-lg`)
- Header with icon (colored circle background) and label
- Large number display (24px-28px, bold)
- Variation indicator with colored badge (green up arrow, red down arrow)
- Padding: `p-6`

**Data Tables:**
- Header row with gray background (`bg-gray-50`)
- Alternating row hover (`hover:bg-gray-50`)
- Cell padding: `px-6 py-4`
- Avatar + name combination for users
- Colored badges for statuses (rounded pill shape)
- Action icons (edit/chat/delete) on row hover
- Pagination at bottom

**Cards (Projects/Notes):**
- White background, `rounded-lg`, `shadow-sm`
- Content padding: `p-4` to `p-6`
- Header with title and metadata
- Color-coded labels/categories as pills
- Progress bars (violet gradient)
- Avatar clusters for collaborators

**Badges & Labels:**
- Rounded pill shape (`rounded-full`)
- Small padding: `px-3 py-1`
- Font: 12px Inter Medium
- Priority colors: Red (Urgent/High), Orange (Medium), Green (Low/Success)
- Status colors: Violet (En négociation), Cyan (Prospect), Green (Gagné)

**Buttons:**
- Primary: Violet background (`bg-violet-600`), white text, `rounded-lg`
- Secondary: White background, violet border, violet text
- Ghost: Transparent background, gray text
- Hover: Darker shade of base color
- Padding: `px-4 py-2` (medium), `px-6 py-3` (large)

**Form Inputs:**
- Border: `border-gray-300`
- Focus: Violet ring (`ring-2 ring-violet-500`)
- Rounded: `rounded-lg`
- Padding: `px-4 py-2`

**Avatars:**
- Circular (`rounded-full`)
- Sizes: 32px (small), 40px (medium), 48px (large)
- Colored rings for online status or role indicators
- Avatar clusters overlapping with negative margin

**Charts & Visualizations:**
- Bar charts with violet gradient bars
- Grid lines in light gray
- Axes labels in gray-500
- Clean, minimal style

### E. Page-Specific Layouts

**Dashboard:**
- Top row: 4 KPI cards with icons and metrics
- Middle section: 2-column layout (Recent Projects left, Activity Feed right)
- Bottom section: 2-column layout (Revenue Overview chart left, Upcoming Tasks right)
- Quick Actions as floating buttons or prominent CTAs

**CRM Module:**
- Top KPI bar: 4 metrics (Total Contacts, Prospects, Conversion, Opportunities)
- Filter bar with search, view toggles (Kanban/List/Table), export
- Main table with columns: Avatar/Name, Email, Company, Status, Budget, Last Activity
- Status badges color-coded
- Actions column with icon buttons

**Notes Module:**
- List view with note cards
- Each card: Category badge (colored), title, content preview, metadata row
- Metadata: Tags, client name, date, author avatar, attachment count
- AI Suggestion banner at top (violet background)
- Filter sidebar: Tags, Clients, Projects
- Floating action button (violet, bottom-right) for voice recording

**Tasks/Project Management:**
- Project selector dropdown at top
- View toggle: Kanban/List/Table
- Kanban columns: À faire, En cours, En revue, Terminé
- Task cards with title, assignee avatars, priority badge, drag handle
- Progress bar for overall project completion

**Documents/Explorer:**
- Left sidebar: Tree navigation with folders/subfolders
- Breadcrumb navigation at top
- Main area: Grid or list view toggle
- File cards with type icon, name, size, author badge, date
- Storage indicator at bottom (progress bar showing usage)
- Actions: New folder, Upload, Search

### F. Interactions & States

**Hover States:**
- Subtle background change (`bg-gray-50` for white cards)
- Icon opacity increase or color shift to violet
- Table rows highlight on hover

**Active/Focus States:**
- Violet ring for focused inputs (`ring-2 ring-violet-500`)
- Violet background for active nav items
- Pressed state: Slightly darker shade

**Drag & Drop:**
- Dragging item: Slight opacity reduction, shadow increase
- Drop zone: Violet dashed border highlight
- Smooth transitions (150-200ms)

**Loading States:**
- Skeleton screens matching component structure
- Subtle shimmer animation
- Violet spinner for critical actions

### G. Animations

Use sparingly:
- Smooth transitions for hover states (150ms)
- Page transitions: Fade in (200ms)
- Dropdown/modal appearances: Scale + fade (200ms)
- No complex scroll animations

### H. Iconography

- Use consistent icon set (Heroicons or Lucide)
- Icon sizes: 16px (inline), 20px (buttons), 24px (headers)
- Icon colors match context (gray-600 default, violet for primary actions)
- Icons in KPI cards use colored circular backgrounds

## Images

**Not Applicable**: This is a SaaS dashboard application with data-driven interfaces. No hero images or large decorative imagery. All visuals are functional: avatars, charts, file previews, and UI icons.