import { NavLink, Outlet } from "react-router-dom"

// Dashboard tabs per blueprint §5. Teams/Connections are stubbed until
// their sessions; Organization Settings appears once orgs exist.
const tabs = [
  { to: "/dashboard/profile", label: "My Profile" },
  { to: "/dashboard/projects", label: "My Projects" },
  { to: "/dashboard/applications", label: "My Applications" },
  { to: "/dashboard/teams", label: "My Teams" },
  { to: "/dashboard/connections", label: "Connections" },
]

export default function DashboardLayout() {
  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr]">
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}