import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Send, ShoppingBag } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiErrorMessage } from "../lib/api-errors";
import { showToast } from "../lib/toast";
import { listingsService } from "../services/listings";
import { messagesService, type Conversation, type ConversationDetail } from "../services/messages";

function timeLabel(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function listingCover(conversation: Conversation | ConversationDetail) {
  return conversation.listing.cover_image ?? undefined;
}

export default function Messages() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get("listing");

  if (conversationId) {
    return <ChatThread conversationId={Number(conversationId)} />;
  }

  return (
    <div className="shell py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf-600">
          Messages
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-leaf-700">
          Buyer ↔ seller chats
        </h1>
        <p className="text-charcoal/70">
          One conversation per listing. Reply, ask questions, and coordinate pickup or shipping.
        </p>
      </div>

      {listingId && <StartChat listingId={listingId} />}

      <ConversationList />
    </div>
  );
}

function StartChat({ listingId }: { listingId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listing = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => listingsService.get(listingId),
  });

  const send = useMutation({
    mutationFn: (message: string) => messagesService.sendToListing(listingId, message),
    onSuccess: (message) => {
      setBody("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", message.conversation_id] });
      navigate(`/messages/${message.conversation_id}`);
    },
    onError: (sendError) => {
      setError(apiErrorMessage(sendError, "Couldn't send your message."));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = body.trim();
    if (!message) {
      const text = "Type a message before sending.";
      setError(text);
      showToast(text, "error", "Invalid action");
      return;
    }
    send.mutate(message);
  }

  if (listing.isPending) {
    return <div className="mt-6 h-40 animate-pulse rounded-3xl bg-leaf-100" />;
  }

  if (listing.isError || !listing.data) {
    return (
      <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        Couldn't load this listing for chat.
      </p>
    );
  }

  const item = listing.data;

  return (
    <section className="mt-6 rounded-3xl border border-leaf-300/40 bg-white p-5">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-leaf-100">
          {item.cover_image ? (
            <img src={item.cover_image} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-leaf-600" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.title}</p>
          <p className="text-sm text-charcoal/60">New conversation with {item.seller.display_name}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5">
        <label className="grid gap-1.5 text-sm font-medium">
          First message
          <Input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Hi! Is this still available?"
            maxLength={2000}
            required
          />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="mt-4" disabled={send.isPending}>
          <Send className="h-4 w-4" /> {send.isPending ? "Sending…" : "Send first message"}
        </Button>
      </form>
    </section>
  );
}

function ConversationList() {
  const { data: conversations, isPending, isError } = useQuery({
    queryKey: ["conversations"],
    queryFn: messagesService.list,
    refetchInterval: 15_000,
  });

  if (isPending) {
    return (
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-leaf-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        Couldn't load your messages.
      </p>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-leaf-300/60 bg-white p-10 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-leaf-500" />
        <p className="mt-3 font-semibold">No conversations yet</p>
        <p className="mt-1 text-sm text-charcoal/60">
          Open a listing and choose “Message seller” to start the first chat.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          to={`/messages/${conversation.id}`}
          className="flex items-center gap-4 rounded-2xl border border-leaf-300/40 bg-white p-4 transition hover:shadow-md"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-leaf-100">
            {listingCover(conversation) ? (
              <img
                src={listingCover(conversation)}
                alt={conversation.listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-leaf-600" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold">{conversation.listing.title}</p>
              <span className="shrink-0 text-xs text-charcoal/50">
                {timeLabel(conversation.last_message_at)}
              </span>
            </div>
            <p className="text-sm text-charcoal/60">{conversation.other_party_display_name}</p>
            <p className="mt-1 truncate text-sm text-charcoal/75">
              {conversation.last_message_body ?? "Say hello to get started."}
            </p>
          </div>

          {conversation.unread_count > 0 && (
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-leaf-600 px-2 text-xs font-bold text-white">
              {conversation.unread_count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

function ChatThread({ conversationId }: { conversationId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => messagesService.get(conversationId),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const send = useMutation({
    mutationFn: (message: string) => messagesService.send(conversationId, message),
    onSuccess: () => {
      setBody("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (sendError) => {
      setError(apiErrorMessage(sendError, "Couldn't send your message."));
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [query.data?.messages.length]);

  if (query.isPending) {
    return <div className="shell py-16 text-center text-charcoal/60">Loading conversation…</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="shell py-16 text-center">
        <p className="text-red-700">Couldn't load this conversation.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/messages")}>
          Back to messages
        </Button>
      </div>
    );
  }

  const conversation = query.data;

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = body.trim();
    if (!message) {
      const text = "Type a message before sending.";
      setError(text);
      showToast(text, "error", "Invalid action");
      return;
    }
    send.mutate(message);
  }

  return (
    <div className="shell py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-leaf-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Messages
        </button>

        <section className="flex items-center gap-4 rounded-3xl border border-leaf-300/40 bg-white p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-leaf-100">
            {listingCover(conversation) ? (
              <img
                src={listingCover(conversation)}
                alt={conversation.listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-leaf-600" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/listing/${conversation.listing.id}`} className="font-semibold hover:underline">
              {conversation.listing.title}
            </Link>
            <p className="text-sm text-charcoal/60">with {conversation.other_party_display_name}</p>
          </div>
          <Link
            to={`/listing/${conversation.listing.id}`}
            className="rounded-full border border-leaf-300/60 px-4 py-2 text-sm font-semibold text-leaf-700 hover:bg-leaf-50"
          >
            View listing
          </Link>
        </section>

        <section className="min-h-96 rounded-3xl border border-leaf-300/40 bg-white p-4">
          {conversation.messages.length === 0 ? (
            <p className="py-16 text-center text-sm text-charcoal/60">No messages yet. Say hello.</p>
          ) : (
            <div className="grid gap-3">
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    message.is_mine
                      ? "ml-auto bg-leaf-600 text-white"
                      : "bg-leaf-100 text-charcoal"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p
                    className={`mt-1 text-right text-[11px] ${
                      message.is_mine ? "text-white/70" : "text-charcoal/50"
                    }`}
                  >
                    {timeLabel(message.created_at)}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <form
          onSubmit={submit}
          className="sticky bottom-4 flex gap-2 rounded-3xl border border-leaf-300/40 bg-white p-2 shadow-lg"
        >
          <Input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            className="border-0 focus:ring-0"
          />
          <Button type="submit" disabled={send.isPending || !body.trim()}>
            <Send className="h-4 w-4" /> {send.isPending ? "Sending…" : "Send"}
          </Button>
        </form>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
