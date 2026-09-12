import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class StartConversationDto {
  @IsUUID()
  user_id!: string;

  /** Optional first message, sent when the conversation is created new. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content?: string;
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}