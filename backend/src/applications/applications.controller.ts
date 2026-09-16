import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { ClerkAuthGuard, AuthenticatedRequest } from "../auth/clerk-auth.guard";
import { ApplicationsService } from "./applications.service";

export class CreateApplicationDto {
  @IsUUID()
  project_id!: string;

  @IsUUID()
  project_role_id!: string;

  /** Required "why are you a good fit" pitch (min length rules out one-word answers). */
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  pitch_note!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  relevant_work_url?: string;
}

export class UpdateApplicationDto {
  @IsIn(["accepted", "rejected", "withdrawn"])
  status!: "accepted" | "rejected" | "withdrawn";
}

@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /** Apply to a specific project_role (flow 4.3). */
  @UseGuards(ClerkAuthGuard)
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApplicationDto) {
    return { application: await this.applicationsService.create(req.authUser.id, dto) };
  }

  /** My Applications (dashboard tab). */
  @UseGuards(ClerkAuthGuard)
  @Get("mine")
  async mine(@Req() req: AuthenticatedRequest) {
    return { applications: await this.applicationsService.listMine(req.authUser.id) };
  }

  /** Accept / reject (poster) or withdraw (applicant) — flow 4.2/4.3. */
  @UseGuards(ClerkAuthGuard)
  @Patch(":id")
  async update(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    await this.applicationsService.updateStatus(req.authUser.id, id, dto.status);
    return { ok: true };
  }
}