import { api } from "../lib/api";

export interface ChatUser {
  id: number;
  display_name: string;
  avatar: string | null;
}

export interface ConversationListing {
  id: string;
  title: string;
  type: string;
  status: string;
  price: string;
  cover_image: string | null;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  is_mine: boolean;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  listing: ConversationListing;
  other_party: ChatUser;
  other_party_display_name: string;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface ConversationDetail {
  id: number;
  listing: ConversationListing;
  other_party: ChatUser;
  other_party_display_name: string;
  last_message_at: string | null;
  created_at: string;
  messages: ChatMessage[];
}

export const messagesService = {
  list: () => api.get<Conversation[]>("/v1/conversations/").then((r) => r.data),

  get: (conversationId: number) =>
    api.get<ConversationDetail>(`/v1/conversations/${conversationId}/`).then((r) => r.data),

  getByListing: (listingId: string) =>
    api
      .get<ConversationDetail>(`/v1/listings/${listingId}/conversation/`)
      .then((r) => r.data),

  sendToListing: (listingId: string, body: string) =>
    api
      .post<ChatMessage>(`/v1/listings/${listingId}/conversation/messages/`, { body })
      .then((r) => r.data),

  send: (conversationId: number, body: string) =>
    api
      .post<ChatMessage>(`/v1/conversations/${conversationId}/messages/`, { body })
      .then((r) => r.data),
};
