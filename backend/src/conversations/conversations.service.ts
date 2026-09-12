import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

// Reusable user profile projection for the "other participant" / sender.
const USER_SELECT = "id, name, avatar_url, headline";

// conversation_participants + the joined user, and messages + the joined
// sender. Explicit FK hints (Postgres default constraint names) keep the
// embedding unambiguous, same as projects.service.ts.
const OTHER_USER_SELECT = `conversation_id, user_id, user:users!conversation_participants_user_id_fkey(${USER_SELECT})`;
const SENDER_SELECT = `id, conversation_id, sender_id, content, created_at, sender:users!messages_sender_id_fkey(${USER_SELECT})`;

export interface MessagePreview {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * All conversations the user participates in, each with the other
   * participant's profile and the newest message for the list preview,
   * ordered by most recent activity desc. Scoped: only the caller's rows.
   */
  async list(authUserId: string) {
    const client = this.supabase.getClient();

    const { data: mine, error: mineErr } = await client
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", authUserId);
    if (mineErr) throw new Error(`DB error: ${mineErr.message}`);
    const conversationIds = (mine ?? []).map((r) => r.conversation_id);
    if (!conversationIds.length) return [];

    const { data: participants, error: pErr } = await client
      .from("conversation_participants")
      .select(OTHER_USER_SELECT)
      .in("conversation_id", conversationIds);
    if (pErr) throw new Error(`DB error: ${pErr.message}`);

    const { data: conversations, error: cErr } = await client
      .from("conversations")
      .select("id, context_type, context_id, created_at, updated_at")
      .in("id", conversationIds);
    if (cErr) throw new Error(`DB error: ${cErr.message}`);

    const { data: messages, error: mErr } = await client
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });
    if (mErr) throw new Error(`DB error: ${mErr.message}`);

    // Newest message per conversation (rows already ordered desc).
    const lastByConversation = new Map<string, MessagePreview>();
    for (const m of messages ?? []) {
      if (!lastByConversation.has(m.conversation_id)) {
        lastByConversation.set(m.conversation_id, m);
      }
    }

    return (conversations ?? [])
      .map((c) => ({
        id: c.id,
        context_type: c.context_type,
        context_id: c.context_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
        other_user:
          (participants ?? [])
            .find((p) => p.conversation_id === c.id && p.user_id !== authUserId)
            ?.user ?? null,
        last_message: lastByConversation.get(c.id) ?? null,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  /**
   * Find-or-create a conversation between the caller and another user.
   * Idempotent: if a mutual conversation already exists it is returned as-is
   * (created=false). A new conversation stores no context (v1 is plain
   * 1:1 chat) and optionally starts with `content` as the first message.
   */
  async findOrCreate(authUserId: string, otherUserId: string, content?: string) {
    if (authUserId === otherUserId) {
      throw new BadRequestException(
        "You can't start a conversation with yourself",
      );
    }
    const client = this.supabase.getClient();

    const existingId = await this.findBetween(authUserId, otherUserId);
    if (existingId) {
      return {
        ...(await this.hydrate(existingId, authUserId)),
        created: false,
      };
    }

    const { data: conversation, error: createErr } = await client
      .from("conversations")
      .insert({ context_type: null, context_id: null })
      .select("id")
      .single();
    if (createErr) throw new Error(`DB error: ${createErr.message}`);

    const { error: p1Err } = await client
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: authUserId });
    const { error: p2Err } = await client
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: otherUserId });
    if (p1Err || p2Err) {
      // Best-effort rollback so a failed half-setup never leaks an empty
      // conversation into the list.
      await client
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversation.id);
      await client.from("conversations").delete().eq("id", conversation.id);
      throw new Error(`DB error: ${p1Err?.message ?? p2Err?.message}`);
    }

    if (content?.trim()) {
      await this.sendMessage(conversation.id, authUserId, content);
    }
    return {
      ...(await this.hydrate(conversation.id, authUserId)),
      created: true,
    };
  }

  /**
   * Messages of one conversation, oldest first — participants only. Also
   * records this read (last_read_at on the caller's participant row) and
   * returns the other participant's last_read_at so the frontend can render
   * "Seen"/"Delivered" on the caller's own sent messages.
   */
  async listMessages(conversationId: string, authUserId: string) {
    const client = this.supabase.getClient();

    const { data: participants, error: pErr } = await client
      .from("conversation_participants")
      .select("conversation_id, user_id, last_read_at")
      .eq("conversation_id", conversationId);
    if (pErr) throw new Error(`DB error: ${pErr.message}`);
    const rows = participants ?? [];
    if (!rows.some((r) => r.user_id === authUserId)) {
      throw new NotFoundException("Conversation not found");
    }
    const other = rows.find((r) => r.user_id !== authUserId);

    // Best-effort read marker: a failure here must never block the thread.
    const { error: readErr } = await client
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", authUserId);
    if (readErr) {
      console.error(
        `[conversations] failed to update last_read_at: ${readErr.message}`,
      );
    }

    const { data, error } = await client
      .from("messages")
      .select(SENDER_SELECT)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`DB error: ${error.message}`);
    return {
      messages: data ?? [],
      last_read_at: other?.last_read_at ?? null,
    };
  }

  /** Append a message to a conversation and bump its activity timestamp. */
  async sendMessage(conversationId: string, senderId: string, content: string) {
    await this.assertCanAccess(conversationId, senderId);
    const client = this.supabase.getClient();

    const { data: message, error } = await client
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      })
      .select(SENDER_SELECT)
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);

    // Drives the conversation-list sort (no last_message_at column — the
    // conversations.updated_at bump is the ordering signal).
    const { error: bumpErr } = await client
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (bumpErr) throw new Error(`DB error: ${bumpErr.message}`);

    return message;
  }

  /** Return the id of the conversation shared by two users, if any. */
  private async findBetween(a: string, b: string): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", a);
    if (error) throw new Error(`DB error: ${error.message}`);
    const ids = (data ?? []).map((r) => r.conversation_id);
    if (!ids.length) return null;

    const { data: other, error: otherErr } = await client
      .from("conversation_participants")
      .select("conversation_id")
      .in("conversation_id", ids)
      .eq("user_id", b);
    if (otherErr) throw new Error(`DB error: ${otherErr.message}`);
    return (other ?? [])[0]?.conversation_id ?? null;
  }

  /** Single-conversation shape used by list rows and find-or-create. */
  private async hydrate(conversationId: string, authUserId: string) {
    const client = this.supabase.getClient();
    const { data: conversation, error: cErr } = await client
      .from("conversations")
      .select("id, context_type, context_id, created_at, updated_at")
      .eq("id", conversationId)
      .single();
    if (cErr) throw new Error(`DB error: ${cErr.message}`);

    const { data: participants, error: pErr } = await client
      .from("conversation_participants")
      .select(OTHER_USER_SELECT)
      .eq("conversation_id", conversationId);
    if (pErr) throw new Error(`DB error: ${pErr.message}`);

    const { data: lastMessage, error: mErr } = await client
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mErr) throw new Error(`DB error: ${mErr.message}`);

    return {
      ...conversation,
      other_user:
        (participants ?? [])
          .find((p) => p.conversation_id === conversationId && p.user_id !== authUserId)
          ?.user ?? null,
      last_message: lastMessage ?? null,
    };
  }

  /**
   * Scope guard for a single conversation: only a participant may read or
   * write it. Everyone else gets a 404 (avoids leaking whether a
   * conversation exists at all).
   */
  private async assertCanAccess(conversationId: string, userId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data?.length) {
      throw new NotFoundException("Conversation not found");
    }
  }
}