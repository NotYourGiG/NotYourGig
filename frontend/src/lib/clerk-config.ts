// Clerk config. The publishable key lives in the root .env
// (VITE_CLERK_PUBLISHABLE_KEY) and is inlined by Vite at dev/build time.
export const clerkPublishableKey: string =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? ""

export const clerkReady = clerkPublishableKey.length > 0
