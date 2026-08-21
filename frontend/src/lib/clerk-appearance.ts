import { dark } from "@clerk/themes"
import type { Theme } from "./theme-context"

// Reads a theme token value from index.css (e.g. --background, --card,
// --foreground). This is the single source of truth: light vs dark values are
// defined once in CSS (.dark overrides) and the Clerk widget follows them, so
// no colors are hardcoded here.
function token(name: string): string {
  if (typeof document === "undefined") return ""
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Keeps Clerk's hosted auth cards visually aligned with the app's light/dark
// theme. Light is Clerk's default, so only dark needs a base theme. Color
// values come from the app's design tokens (index.css) rather than hardcoded
// hex, and the theme class is applied to <html> before these values are read.
export function getClerkAppearance(theme: Theme) {
  const isDark = theme === "dark"
  return {
    baseTheme: isDark ? dark : undefined,
    variables: {
      colorBackground: token("--background"),
      colorForeground: token("--foreground"),
      colorPrimary: token("--primary"),
      colorPrimaryForeground: token("--primary-foreground"),
      // Inputs: colorInput = input background, colorInputForeground = input text.
      // Matches the app's Input (bg-background + text-foreground) per theme.
      colorInput: token("--card"),
      colorInputForeground: token("--foreground"),
      colorText: token("--foreground"),
      colorTextSecondary: token("--muted-foreground"),
      colorMuted: token("--muted"),
      colorMutedForeground: token("--muted-foreground"),
      colorBorder: token("--border"),
      colorRing: token("--ring"),
      colorDanger: token("--destructive"),
    },
  }
}