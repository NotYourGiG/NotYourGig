import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, AuthenticatedRequest } from "../auth/clerk-auth.guard";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto, CreateRoleDto, UpdateProjectDto } from "./dto";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /** GET /projects — filters: type, skill, poster (org|individual), status. */
  @Get()
  async list(
    @Query()
    q: {
      type?: string;
      skill_id?: string;
      poster?: string;
      status?: string;
      user_id?: string;
      page?: string;
      per_page?: string;
    },
  ) {
    return this.projectsService.list({
      type: q.type,
      skill_id: q.skill_id,
      poster: q.poster,
      status: q.status,
      user_id: q.user_id,
      page: q.page ? Number(q.page) : undefined,
      per_page: q.per_page ? Number(q.per_page) : undefined,
    });
  }

  @UseGuards(ClerkAuthGuard)
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProjectDto) {
    return { project: await this.projectsService.create(req.authUser.id, dto) };
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return { project: await this.projectsService.findOne(id) };
  }

  @UseGuards(ClerkAuthGuard)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProjectDto,
  ) {
    await this.assertOwner(id, req.authUser.id);
    return { project: await this.projectsService.update(id, dto) };
  }

  @UseGuards(ClerkAuthGuard)
  @Post(":id/roles")
  async addRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRoleDto,
  ) {
    await this.assertOwner(id, req.authUser.id);
    return { role: await this.projectsService.addRole(id, dto) };
  }

  /** Applicant review list (flow 4.2) — poster only. */
  @UseGuards(ClerkAuthGuard)
  @Get(":id/applications")
  async applications(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    await this.assertOwner(id, req.authUser.id);
    return { applications: await this.projectsService.listApplications(id) };
  }

  private async assertOwner(projectId: string, userId: string) {
    const project = await this.projectsService.findOne(projectId);
    if (project.posted_by_user_id !== userId) {
      throw new ForbiddenException("Only the project poster can do this");
    }
  }
}