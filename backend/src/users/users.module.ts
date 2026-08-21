import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { SkillsController } from "./skills.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuthModule],
  controllers: [UsersController, SkillsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}