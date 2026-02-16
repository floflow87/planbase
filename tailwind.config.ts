import type { Config } from "tailwindcss";
import { PROJECT_STAGES } from "./shared/config/projectStages";
import { BILLING_STATUSES } from "./shared/config/billingStatuses";

function extractClasses(...sources: readonly { colorClass: string; textColorClass: string; darkColorClass: string }[][]): string[] {
  const classes = new Set<string>();
  for (const arr of sources) {
    for (const item of arr) {
      for (const val of [item.colorClass, item.textColorClass, item.darkColorClass]) {
        if (val) val.split(/\s+/).forEach(c => c && classes.add(c));
      }
    }
  }
  return Array.from(classes);
}

const dynamicSafelist = extractClasses(PROJECT_STAGES as any, BILLING_STATUSES as any);

const extraColorSafelist = [
  "bg-orange-100", "border-orange-200", "text-orange-700",
  "dark:bg-orange-900/30", "dark:text-orange-300", "dark:border-orange-800",
  "bg-pink-100", "border-pink-200", "text-pink-700",
  "dark:bg-pink-900/30", "dark:text-pink-300", "dark:border-pink-800",
  "bg-indigo-100", "border-indigo-200", "text-indigo-700",
  "dark:bg-indigo-900/30", "dark:text-indigo-300", "dark:border-indigo-800",
  "bg-emerald-100", "border-emerald-200", "text-emerald-700",
  "dark:bg-emerald-900/30", "dark:text-emerald-300", "dark:border-emerald-800",
  "bg-amber-100", "border-amber-200", "text-amber-700",
  "dark:bg-amber-900/30", "dark:text-amber-300", "dark:border-amber-800",
  "bg-lime-100", "border-lime-200", "text-lime-700",
  "dark:bg-lime-900/30", "dark:text-lime-300", "dark:border-lime-800",
  "bg-rose-100", "border-rose-200", "text-rose-700",
  "dark:bg-rose-900/30", "dark:text-rose-300", "dark:border-rose-800",
  "bg-sky-100", "border-sky-200", "text-sky-700",
  "dark:bg-sky-900/30", "dark:text-sky-300", "dark:border-sky-800",
  "bg-fuchsia-100", "border-fuchsia-200", "text-fuchsia-700",
  "dark:bg-fuchsia-900/30", "dark:text-fuchsia-300", "dark:border-fuchsia-800",
];

const stageSafelist = [...new Set([...dynamicSafelist, ...extraColorSafelist])];

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}", "./shared/**/*.{js,ts}"],
  safelist: stageSafelist,
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem", /* 9px */
        md: ".375rem", /* 6px */
        sm: ".1875rem", /* 3px */
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        budget: {
          DEFAULT: "hsl(var(--budget) / <alpha-value>)",
          foreground: "hsl(var(--budget-foreground) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-heading)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-bold": "inherit",
            color: "inherit",
            maxWidth: "none",
            strong: {
              color: "inherit",
              fontWeight: "700",
            },
            em: {
              color: "inherit",
            },
            code: {
              color: "inherit",
            },
            a: {
              color: "inherit",
              textDecoration: "underline",
              fontWeight: "500",
            },
            h1: {
              color: "inherit",
            },
            h2: {
              color: "inherit",
            },
            h3: {
              color: "inherit",
            },
            h4: {
              color: "inherit",
            },
            h5: {
              color: "inherit",
            },
            h6: {
              color: "inherit",
            },
            blockquote: {
              color: "inherit",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
