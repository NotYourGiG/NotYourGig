import clsx, { type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// shadcn/ui cn() helper — the one shared util the UI layer needs.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}