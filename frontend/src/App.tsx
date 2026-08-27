import { Route, Routes } from "react-router-dom"
import AppLayout from "./components/AppLayout"
import DashboardLayout from "./components/DashboardLayout"
import RequireAuth from "./components/RequireAuth"
import RequireGithub from "./components/RequireGithub"
import PlaceholderPage from "./pages/PlaceholderPage"
import { Input } from "./components/ui"
import LandingPage from "./pages/LandingPage"
import SignInPage from "./pages/SignInPage"
import SignUpPage from "./pages/SignUpPage"
import BuilderProfilePage from "./pages/BuilderProfilePage"
import BrowseProjectsPage from "./pages/BrowseProjectsPage"
import PostProjectPage from "./pages/PostProjectPage"
import ProjectDetailPage from "./pages/ProjectDetailPage"
import ProfilePage from "./pages/dashboard/ProfilePage"
import DashboardHomePage from "./pages/dashboard/DashboardHomePage"
import MyProjectsPage from "./pages/dashboard/MyProjectsPage"
import MyApplicationsPage from "./pages/dashboard/MyApplicationsPage"

// Route map per blueprint.md Section 5 (Information Architecture).
// Public: Landing, Browse Projects, Explore Builders, Profile (limited detail).
// Authenticated: Post a Project, Dashboard. Chat/Connections/Org settings
// are deferred to later sessions (placeholders for now).
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/projects" element={<BrowseProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/builders" element={<PlaceholderPage title="Explore Builders"
            topContent={
              <Input
                type="search"
                placeholder="Search builders by skill or name..."
                className="h-11 text-base font-semibold"
                aria-label="Search builders by skill or name"
              />
            }
          />
        } />
        <Route path="/builders/:userId" element={<BuilderProfilePage />} />

        {/* Authenticated */}
        <Route
          path="/projects/new"
          element={
            <RequireAuth>
              <RequireGithub>
                <PostProjectPage />
              </RequireGithub>
            </RequireAuth>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          {/* Dashboard home = 3 category cards. Reachable only once GitHub
              is connected (mandatory gate in DashboardLayout). */}
          <Route index element={<DashboardHomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="projects" element={<MyProjectsPage />} />
          <Route path="applications" element={<MyApplicationsPage />} />
          <Route path="teams" element={<PlaceholderPage title="My Teams" />} />
          <Route path="connections" element={<PlaceholderPage title="Connections" />} />
        </Route>
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <PlaceholderPage title="Chat" />
            </RequireAuth>
          }
        />

        <Route path="*" element={<PlaceholderPage title="Not Found" />} />
      </Route>
    </Routes>
  )
}