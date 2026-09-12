import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, AuthenticatedRequest } from "../auth/clerk-auth.guard";
import { ConversationsService } from "./conversations.service";
import { CreateMessageDto, StartConversationDto } from "./dto";

// Chat routes (blueprint §5 Messaging + the find-or-create entry the
// "Message" button needs). Every route is Clerk-guarded and scoped to the
// caller in the service (participants only; everyone else gets a 404).
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  /** GET /conversations — the caller's conversations, newest activity first. */
  @UseGuards(ClerkAuthGuard)
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return {
      conversations: await this.conversationsService.list(req.authUser.id),
    };
  }

  /** POST /conversations — find-or-create with another user ({ user_id }). */
  @UseGuards(ClerkAuthGuard)
  @Post()
  async start(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartConversationDto,
  ) {
    return {
      conversation: await this.conversationsService.findOrCreate(
        req.authUser.id,
        dto.user_id,
        dto.content,
      ),
    };
  }

  /** GET /conversations/:id/messages — one thread, oldest first (+ receipts). */
  @UseGuards(ClerkAuthGuard)
  @Get(":id/messages")
  async messages(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.conversationsService.listMessages(id, req.authUser.id);
  }

  /** POST /conversations/:id/messages — append a message ({ content }). */
  @UseGuards(ClerkAuthGuard)
  @Post(":id/messages")
  async send(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMessageDto,
  ) {
    return {
      message: await this.conversationsService.sendMessage(
        id,
        req.authUser.id,
        dto.content,
      ),
    };
  }
}