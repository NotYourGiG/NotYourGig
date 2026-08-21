import { SignIn } from "@clerk/clerk-react"
import { useTheme } from "../lib/theme-context"
import { getClerkAppearance } from "../lib/clerk-appearance"

export default function SignInPage() {
  const { theme } = useTheme()

  return (
    <div className="flex flex-col items-center gap-2 py-12">
      <SignIn
        appearance={getClerkAppearance(theme)}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard/profile"
      />
    </div>
  )
}
