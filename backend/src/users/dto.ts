import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

// All API bodies use snake_case keys to match the DB columns 1:1
// (blueprint §6), keeping the no-ORM mapping trivial.

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(["available", "busy", "not_looking"])
  availability_status?: string;

  @IsOptional()
  @IsIn(["builder", "founder", "both"])
  primary_role?: string;
}

export class AddSkillDto {
  @IsUUID()
  skill_id!: string;

  @IsIn(["beginner", "intermediate", "advanced", "expert"])
  level!: string;
}

export class AddProofDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  link_github?: string;

  @IsOptional()
  @IsString()
  link_live_demo?: string;

  @IsOptional()
  @IsString()
  link_other?: string;

  @IsOptional()
  @IsString()
  role_played?: string;
}