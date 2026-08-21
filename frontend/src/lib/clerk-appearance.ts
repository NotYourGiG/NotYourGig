import { dark } from "@clerk/themes"
import type { Theme } from "./theme-context"

// Keeps Clerk's hosted auth cards visually aligned with the app's light/dark
// theme. Light is Clerk's default, so only dark needs a base theme; colors
// mirror the tokens in index.css rather than inverting them.
export function getClerkAppearance(theme: Theme) {
  const isDark = theme === "dark"
  return {
    baseTheme: isDark ? dark : undefined,
    variables: {
      colorBackground: isDark ? "#0b0b0c" : "#ffffff",
      colorForeground: isDark ? "#fafafa" : "#0b0b0c",
      colorPrimary: isDark ? "#ececf1" : "#0b0b0c",
      colorPrimaryForeground: isDark ? "#0b0b0c" : "#ffffff",
      colorInputBackground: isDark ? "#18181b" : "#ffffff",
      colorInput: isDark ? "#fafafa" : "#0b0b0c",
      colorText: isDark ? "#fafafa" : "#0b0b0c",
      colorTextSecondary: isDark ? "#a1a1aa" : "#6b7280",
      colorDanger: isDark ? "#e5484d" : "#dc2626",
    },
  }
}