import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateRoleDto {
  @IsUUID()
  skill_id!: string;

  @IsOptional()
  @IsIn(["any", "junior", "mid", "senior"])
  seniority?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  headcount_needed?: number;
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsIn(["paid", "unpaid", "equity", "learning"])
  type!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget_amount?: number;

  @IsOptional()
  @IsString()
  budget_currency?: string;

  @IsOptional()
  @IsUUID()
  posted_by_user_id?: string;

  @IsOptional()
  @IsUUID()
  posted_by_org_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoleDto)
  roles!: CreateRoleDto[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(["paid", "unpaid", "equity", "learning"])
  type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget_amount?: number;

  @IsOptional()
  @IsString()
  budget_currency?: string;

  @IsOptional()
  @IsIn(["open", "in_progress", "completed", "cancelled"])
  status?: string;
}