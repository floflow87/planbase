/**
 * Buddy Design System V1 - Central Export
 * 
 * Four-layer architecture:
 * 1. Tokens - Foundational design values (colors, spacing, etc.)
 * 2. Semantics - Business-to-design mappings (intents, status colors)
 * 3. Primitives - Atomic UI components (Badge, Button, etc.) - client-side only
 * 4. Product - Business components (ProjectStageBadge, etc.) - client-side only
 */

// Layer 1: Design Tokens
export * from "./tokens";

// Layer 2: Semantic Mappings
export * from "./semantics";

// Note: Layers 3 & 4 (Primitives & Product) are client-side only
// Import from client/src/design-system/
