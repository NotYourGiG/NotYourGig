import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { api } from "../lib/api"
import { useCurrentUser } from "../lib/user-context"
import { Button, EmptyState, Loading, Textarea } from "../components/ui"
import { cn } from "../lib/utils"
import type { ChatMessage, Conversation } from "../lib/types"

// Starter greetings shown when a thread is empty: pick & send instantly,
// or write your own in the composer below (scope decision).
const STARTERS = [
  "Hi, I'd like to connect about a potential project",
  "I saw your profile and think we'd work well together",
  "Hey! Are you open to collaborating on something?",
]

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

export default function ChatPage() {
  const { user } = useCurrentUser()
  const [searchParams, setSearchParams] = useSearchParams()

  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  // The other participant's last_read_at from the active conversation's
  // messages fetch — drives the "Seen"/"Delivered" label on my sent messages.
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Mobile-only toggle: when open, the conversation list covers the thread.
  const [listOpen, setListOpen] = useState(false)

  // Fetch the conversation list once. No real-time — refresh to reload.
  useEffect(() => {
    api<{ conversations: Conversation[] }>("/conversations")
      .then((d) => setConversations(d.conversations))
      .catch(() => setConversations([]))
  }, [])

  // Resolve the selected conversation: ?c= param wins, else the newest.
  useEffect(() => {
    if (conversations === null) return
    const fromParam = searchParams.get("c")
    const wanted = fromParam ? conversations.find((c) => c.id === fromParam) : null
    const next = wanted ?? conversations[0]
    if (!next) return
    if (next.id !== fromParam) {
      setSearchParams({ c: next.id }, { replace: true })
    }
    if (next.id !== active?.id) setActive(next)
  }, [conversations, searchParams, active?.id, setSearchParams])

  // Load the thread for the active conversation on selection only.
  useEffect(() => {
    if (!active) {
      setMessages(null)
      return
    }
    let cancelled = false
    setMessages(null)
    setOtherLastReadAt(null)
    api<{ messages: ChatMessage[]; last_read_at: string | null }>(`/conversations/${active.id}/messages`)
      .then((d) => {
        if (!cancelled) {
          setMessages(d.messages)
          setOtherLastReadAt(d.last_read_at)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
          setError("Could not load messages")
        }
      })
    return () => {
      cancelled = true
    }
  }, [active?.id])

  const selectConversation = (id: string) => {
    setSearchParams({ c: id }, { replace: true })
    setListOpen(false)
  }

  async function sendMessage(text: string) {
    const content = text.trim()
    if (!content || !active || sending) return
    setSending(true)
    setError(null)
    try {
      const d = await api<{ message: ChatMessage }>(`/conversations/${active.id}/messages`, {
        method: "POST",
        body: { content },
      })
      const sent = d.message
      setMessages((ms) => [...(ms ?? []), sent])
      setDraft("")
      // Keep the left-pane preview + ordering in sync with the send.
      setConversations((cs) =>
        (cs ?? [])
          .map((c) =>
            c.id === active.id
              ? {
                  ...c,
                  updated_at: sent.created_at,
                  last_message: {
                    id: sent.id,
                    conversation_id: sent.conversation_id,
                    sender_id: sent.sender_id,
                    content: sent.content,
                    created_at: sent.created_at,
                  },
                }
              : c,
          )
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Chat</h1>

      {error ? (
        <p className="mt-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {conversations === null ? (
        <Loading />
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[300px_1fr]">
          {/* Conversation list — hidden on mobile while a thread is open */}
          <div className={cn(listOpen ? "" : "hidden", "md:block")}>
            <h2 className="mb-2 text-sm font-semibold">Conversations</h2>
            {conversations.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                hint={
                  <Link to="/builders" className="underline">
                    Message someone from a profile
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectConversation(c.id)}
                    className={cn(
                      "block w-full rounded-md border p-3 text-left transition-colors",
                      c.id === active?.id ? "border-ring bg-accent" : "border-border bg-card hover:border-ring",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{c.other_user?.name ?? "Unknown"}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {c.last_message ? c.last_message.content : "No messages yet"}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{formatTime(c.updated_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thread pane */}
          <div className={cn(listOpen ? "hidden" : "", "md:block")}>
            {!active ? (
              <EmptyState title="Select a conversation" hint="Pick someone from the list to start chatting." />
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setListOpen(true)}
                  className="text-xs text-muted-foreground underline md:hidden"
                >
                  ‹ Conversations
                </button>
                <h2 className="text-base font-semibold">{active.other_user?.name ?? "Conversation"}</h2>

                <div className="h-[460px] overflow-y-auto rounded-md border border-border bg-card p-3 md:h-[520px]">
                  <div className="flex flex-col gap-2">
                    {messages === null ? (
                      <Loading />
                    ) : messages.length === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          No messages yet with {active.other_user?.name ?? "this user"}. Pick a greeting or write your own:
                        </p>
                        <div className="space-y-2">
                          {STARTERS.map((s) => (
                            <Button
                              key={s}
                              variant="outline"
                              className="w-full justify-start text-left"
                              onClick={() => sendMessage(s)}
                            >
                              {s}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : (
                      messages.map((m) => {
                        const mine = m.sender_id === user?.id
                        // WhatsApp-style receipt: a sent message counts as
                        // "Seen" once the other participant's last_read_at is
                        // at or past this message's timestamp.
                        const receipt =
                          otherLastReadAt && new Date(m.created_at) <= new Date(otherLastReadAt)
                            ? "Seen"
                            : "Delivered"
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "max-w-[80%] rounded-lg p-2.5 text-sm",
                              mine
                                ? "self-end bg-primary text-primary-foreground"
                                : "self-start bg-muted text-foreground",
                            )}
                          >
                            {!mine ? <p className="text-[10px] text-muted-foreground">{m.sender?.name ?? "User"}</p> : null}
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            {mine ? (
                              <p className="text-right text-[10px] text-muted-foreground">
                                {formatTime(m.created_at)} · {receipt}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <Textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(draft)
                      }
                    }}
                    placeholder="Write a message…"
                  />
                  <Button onClick={() => sendMessage(draft)} disabled={sending || !draft.trim()}>
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}