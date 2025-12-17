/**
 * Color Tokens - Design System V1
 * 
 * Foundational color palette aligned with Buddy design system
 * Uses HSL format for Tailwind compatibility
 */

export const colors = {
  // Primary - Violet
  primary: {
    50: "263 80% 97%",
    100: "263 70% 94%",
    200: "263 65% 85%",
    300: "263 60% 75%",
    400: "263 70% 65%",
    500: "263 70% 50%", // #7C3AED
    600: "263 70% 45%",
    700: "263 70% 40%",
    800: "263 70% 30%",
    900: "263 70% 20%",
  },

  // Accent - Cyan
  accent: {
    50: "187 80% 97%",
    100: "187 70% 90%",
    200: "187 75% 80%",
    300: "187 80% 70%",
    400: "187 85% 55%",
    500: "187 94% 43%", // #06B6D4
    600: "187 94% 38%",
    700: "187 94% 30%",
    800: "187 94% 22%",
    900: "187 94% 15%",
  },

  // Success - Green
  success: {
    50: "152 75% 97%",
    100: "152 70% 92%",
    200: "152 70% 82%",
    300: "152 65% 65%",
    400: "152 70% 50%",
    500: "160 84% 39%", // #10B981
    600: "160 84% 34%",
    700: "160 84% 28%",
    800: "160 84% 20%",
    900: "160 84% 12%",
  },

  // Warning - Amber/Yellow
  warning: {
    50: "48 95% 95%",
    100: "48 95% 88%",
    200: "48 95% 78%",
    300: "48 95% 65%",
    400: "43 95% 55%",
    500: "38 92% 50%", // Amber-500
    600: "32 95% 44%",
    700: "26 90% 37%",
    800: "22 82% 31%",
    900: "21 78% 26%",
  },

  // Danger - Red
  danger: {
    50: "0 85% 97%",
    100: "0 90% 93%",
    200: "0 95% 87%",
    300: "0 95% 76%",
    400: "0 90% 65%",
    500: "0 84% 60%", // Red-500
    600: "0 72% 51%",
    700: "0 74% 42%",
    800: "0 70% 35%",
    900: "0 63% 31%",
  },

  // Info - Blue
  info: {
    50: "214 100% 97%",
    100: "214 95% 93%",
    200: "213 97% 87%",
    300: "212 96% 78%",
    400: "213 94% 68%",
    500: "217 91% 60%", // Blue-500
    600: "221 83% 53%",
    700: "224 76% 48%",
    800: "226 71% 40%",
    900: "224 64% 33%",
  },

  // Neutral - Gray
  neutral: {
    50: "0 0% 98%",
    100: "0 0% 96%",
    200: "0 0% 90%",
    300: "0 0% 83%",
    400: "0 0% 64%",
    500: "0 0% 45%",
    600: "0 0% 32%",
    700: "0 0% 25%",
    800: "0 0% 15%",
    900: "0 0% 9%",
  },
} as const;

export type ColorScale = keyof typeof colors;
export type ColorShade = keyof typeof colors.primary;

/**
 * Get a color value in HSL format
 */
export function getColor(scale: ColorScale, shade: ColorShade): string {
  return colors[scale][shade];
}

/**
 * Get a color as hsl() CSS function
 */
export function getColorHsl(scale: ColorScale, shade: ColorShade): string {
  return `hsl(${colors[scale][shade]})`;
}
