import { SignUp } from "@clerk/clerk-react"
import { useTheme } from "../lib/theme-context"
import { getClerkAppearance } from "../lib/clerk-appearance"

export default function SignUpPage() {
  const { theme } = useTheme()

  return (
    <div className="flex flex-col items-center gap-2 py-12">
      <SignUp
        appearance={getClerkAppearance(theme)}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard/profile"
      />
    </div>
  )
}
