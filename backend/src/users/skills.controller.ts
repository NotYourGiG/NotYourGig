import { Controller, Get, Query } from "@nestjs/common";
import { UsersService } from "./users.service";

// Supporting endpoint for the profile skill picker: search the curated
// skills table (blueprint §6 — no free text, must come from the table).
@Controller("skills")
export class SkillsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async search(@Query("q") q?: string) {
    return { skills: await this.usersService.searchSkills(q) };
  }
}