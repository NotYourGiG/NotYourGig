import { useNavigate } from "react-router-dom"
import { api } from "../lib/api"
import { useCurrentUser } from "../lib/user-context"
import ProjectForm, {
  emptyProjectFormRole,
  type ProjectFormRole,
  type ProjectFormValues,
} from "../components/ProjectForm"
import type { Project } from "../lib/types"

// Post a Project (flow 4.2): reuses the shared ProjectForm — title,
// description, type, optional budget, one or more roles.
export default function PostProjectPage() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()

  async function onSubmit(values: ProjectFormValues, roles: ProjectFormRole[]) {
    if (!user) return
    const d = await api<{ project: Project }>("/projects", {
      method: "POST",
      body: {
        title: values.title,
        description: values.description,
        type: values.type,
        budget_amount:
          values.type === "paid" && values.budget ? Number(values.budget) : undefined,
        budget_currency: values.currency,
        repo_url: values.repoUrl || undefined,
        demo_url: values.demoUrl || undefined,
        posted_by_user_id: user.id,
        roles: roles.map((r) => ({
          skill_id: r.skill!.id,
          seniority: r.seniority,
          headcount_needed: r.headcount,
        })),
      },
    })
    navigate(`/projects/${d.project.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Post a Project</h1>
        <p className="text-sm text-muted-foreground">
          Find people who can prove they can do the work.
        </p>
      </div>

      <ProjectForm
        mode="create"
        submitLabel="Post project"
        initial={{
          title: "",
          description: "",
          repoUrl: "",
          demoUrl: "",
          type: "unpaid",
          status: "open",
          budget: "",
          currency: "INR",
        }}
        initialRoles={[emptyProjectFormRole()]}
        onSubmit={onSubmit}
      />
    </div>
  )
}