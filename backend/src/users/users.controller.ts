import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, AuthenticatedRequest } from "../auth/clerk-auth.guard";
import { UsersService } from "./users.service";
import { AddProofDto, AddSkillDto, UpdateProfileDto } from "./dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /users/:id — public profile (user + skills + proof). */
  @Get(":id")
  async getProfile(@Param("id", ParseUUIDPipe) id: string) {
    return { user: await this.usersService.findProfile(id) };
  }

  /** PATCH /users/:id — owner only. */
  @UseGuards(ClerkAuthGuard)
  @Patch(":id")
  async updateProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    this.assertOwner(req.authUser.id, id);
    return { user: await this.usersService.updateProfile(id, body) };
  }

  /** GET /users/:id/skills — public, part of the profile page. */
  @Get(":id/skills")
  async getSkills(@Param("id", ParseUUIDPipe) id: string) {
    return { skills: await this.usersService.listSkills(id) };
  }

  /** POST /users/:id/skills — owner only. */
  @UseGuards(ClerkAuthGuard)
  @Post(":id/skills")
  async addSkill(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: AddSkillDto,
  ) {
    this.assertOwner(req.authUser.id, id);
    await this.usersService.addSkill(id, body.skill_id, body.level);
    return { skills: await this.usersService.listSkills(id) };
  }

  /** GET /users/:id/proof — public, part of the profile page. */
  @Get(":id/proof")
  async getProof(@Param("id", ParseUUIDPipe) id: string) {
    return { proof: await this.usersService.listProof(id) };
  }

  /** POST /users/:id/proof — owner only. */
  @UseGuards(ClerkAuthGuard)
  @Post(":id/proof")
  async addProof(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: AddProofDto,
  ) {
    this.assertOwner(req.authUser.id, id);
    await this.usersService.addProof(id, body);
    return { proof: await this.usersService.listProof(id) };
  }

  /** DELETE /users/:id/proof/:proofId — owner only. */
  @UseGuards(ClerkAuthGuard)
  @Delete(":id/proof/:proofId")
  async deleteProof(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("proofId", ParseUUIDPipe) proofId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwner(req.authUser.id, id);
    await this.usersService.deleteProof(id, proofId);
    return { proof: await this.usersService.listProof(id) };
  }

  private assertOwner(authUserId: string, targetId: string) {
    if (authUserId !== targetId) {
      throw new ForbiddenException("You can only edit your own profile");
    }
  }
}