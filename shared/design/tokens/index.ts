/**
 * Design Tokens - Central Export
 * 
 * All foundational design tokens for the Buddy Design System V1
 */

// Colors
export { colors, getColor, getColorHsl } from "./colors";
export type { ColorScale, ColorShade } from "./colors";

// Spacing
export { spacing, semanticSpacing } from "./spacing";
export type { SpacingKey, SemanticSpacingCategory } from "./spacing";

// Border Radius
export { radius, semanticRadius } from "./radius";
export type { RadiusKey, SemanticRadiusKey } from "./radius";

// Typography
export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
} from "./typography";
export type { FontSizeKey, FontWeightKey, TextStyleKey } from "./typography";

// Shadows
export { shadows, semanticShadows } from "./shadows";
export type { ShadowKey, SemanticShadowKey } from "./shadows";

// Component Tokens
export { badgeTokens, getBadgeBaseClasses } from "./components";
export type { BadgeSize } from "./components";

// Surface Tokens (V1.3)
export {
  surfaceTokens,
  getSurfaceClasses,
  inputSurfaceTokens,
  popoverSurfaceTokens,
  getSelectSurfaceClasses,
} from "./surfaces";
export type { SurfaceKey } from "./surfaces";
