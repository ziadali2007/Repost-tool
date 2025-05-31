import { InferInsertModel, InferSelectModel, sql } from "drizzle-orm";
import {
  text,
  sqliteTable,
  unique,
  integer, // Use integer for SQLite
} from "drizzle-orm/sqlite-core";

// export const chatsTable = sqliteTable("chats", {});
export const authCredsTable = sqliteTable("auth_creds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull().unique(),
  data: text("data").notNull(),
});

export const authKeysTable = sqliteTable(
  "auth_keys",
  {
    clientId: text("client_id").notNull(),
    keyType: text("key_type").notNull(), // e.g., 'pre-key', 'session', 'sender-key', etc.
    keyId: text("key_id").notNull(),
    data: text("data").notNull(), // Store serialized key data
  },
  (table) => [unique().on(table.clientId, table.keyType, table.keyId)],
);

export const chats = sqliteTable("chats", {
  clientId: text("client_id").notNull(),
  id: text("id").notNull().primaryKey().unique(), // Chat JID
  messages: text("messages", { mode: "json" }), // Store as JSON text
  newJid: text("new_jid"),
  oldJid: text("old_jid"),
  lastMsgTimestamp: integer("last_msg_timestamp", { mode: "number" }), // Use integer for timestamp
  unreadCount: integer("unread_count"),
  readOnly: integer("read_only", { mode: "boolean" }), // Use integer for boolean
  endOfHistoryTransfer: integer("end_of_history_transfer", {
    mode: "boolean",
  }),
  ephemeralExpiration: integer("ephemeral_expiration"),
  ephemeralSettingTimestamp: integer("ephemeral_setting_timestamp", {
    mode: "number",
  }),
  endOfHistoryTransferType: integer("end_of_history_transfer_type"),
  conversationTimestamp: integer("conversation_timestamp", {
    mode: "number",
  }),
  name: text("name"),
  pHash: text("p_hash"),
  notSpam: integer("not_spam", { mode: "boolean" }),
  archived: integer("archived", { mode: "boolean" }),
  disappearingMode: text("disappearing_mode", { mode: "json" }), // Store as JSON text
  unreadMentionCount: integer("unread_mention_count"),
  markedAsUnread: integer("marked_as_unread", { mode: "boolean" }),
  participant: text("participant", { mode: "json" }), // Store as JSON text
  tcToken: text("tc_token"),
  tcTokenTimestamp: integer("tc_token_timestamp", { mode: "number" }),
  contactPrimaryIdentityKey: text("contact_primary_identity_key"),
  pinned: integer("pinned", { mode: "number" }), // Use integer for timestamp or 0
  muteEndTime: integer("mute_end_time", { mode: "number" }),
  securitySettings: text("security_settings", { mode: "json" }), // Store as JSON text
  conversationAuth: text("conversation_auth", { mode: "json" }), // Store as JSON text
  nonAdminMarkedAsUnread: integer("non_admin_marked_as_unread", {
    mode: "boolean",
  }),
  bizPrivacyStatus: integer("biz_privacy_status"),
  shareOwnPn: integer("share_own_pn", { mode: "boolean" }),
  pnhDuplicateLidThread: integer("pnh_duplicate_lid_thread", {
    mode: "boolean",
  }),
  lidJid: text("lid_jid"),
  lastMessageRecvTimestamp: integer("last_message_recv_timestamp", {
    mode: "number",
  }),
});

export const messages = sqliteTable("messages", {
  clientId: text("client_id").notNull(),
  remoteJid: text("remote_jid"),
  fromMe: integer("from_me", { mode: "boolean" }),
  id: text("id").notNull().primaryKey().unique(), // Message ID
  participant: text("participant"),
  message: text("message", { mode: "json" }), // Store as JSON text
  messageTimestamp: integer("message_timestamp", { mode: "number" }),
  status: integer("status"),
  pushName: text("push_name"),
  broadcast: integer("broadcast", { mode: "boolean" }),
  starred: integer("starred", { mode: "boolean" }),
  messageStubType: integer("message_stub_type"),
  messageStubParameters: text("message_stub_parameters", { mode: "json" }), // Store as JSON text
  labels: text("labels", { mode: "json" }), // Store as JSON text
  userReceipt: text("user_receipt", { mode: "json" }), // Store as JSON text
  reactions: text("reactions", { mode: "json" }), // Store as JSON text
  mediaData: text("media_data", { mode: "json" }), // Store as JSON text
  pollUpdates: text("poll_updates", { mode: "json" }), // Store as JSON text
  keepInChat: integer("keep_in_chat", { mode: "boolean" }),
  messageSecret: text("message_secret"),
  pinInChat: text("pin_in_chat", { mode: "json" }), // Store as JSON text
  // Foreign key relationship (Drizzle handles this conceptually, actual constraint depends on SQLite version/config)
  chatId: text("chat_id"),
  isAnalyzed: integer("is_analyzed", { mode: "boolean" }).default(false),
});

export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  referenceNumber: text("reference_number").notNull(),
  image: text("image"),
  ownerNumber: text("owner_number").notNull(),
  ownerPushName: text("owner_push_name").notNull(),
  originalMessageId: text("original_message_id").notNull(),
});

export const messagingLists = sqliteTable("messaging_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull(), // Added clientId
  name: text("name").notNull(),
  description: text("description"),
  ownerNumber: text("owner_number").notNull(), // Consider if this is still needed or if clientId suffices
});

export type MessagingListInsert = InferInsertModel<typeof messagingLists>;
export type MessagingListSelect = InferSelectModel<typeof messagingLists>;

export const messagingListMembers = sqliteTable(
  "messaging_list_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: text("client_id").notNull(), // Added clientId
    name: text("name").notNull(), // Name of the chat/group added
    remoteJid: text("remote_jid").notNull(), // JID of the chat/group added
    listId: integer("list_id")
      .notNull()
      .references(() => messagingLists.id, { onDelete: "cascade" }), // Cascade delete members when list is deleted
  },
  (table) => [
    unique().on(table.listId, table.remoteJid), // Ensure a chat is only added once per list
  ],
);

export type MessagingListMemberInsert = InferInsertModel<
  typeof messagingListMembers
>;
export type MessagingListMemberSelect = InferSelectModel<
  typeof messagingListMembers
>;

export const broadcasts = sqliteTable("broadcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerNumber: text("owner_number").notNull(),
  content: text("content").notNull(),
  // sentAt: integer("sent_at", { mode: "timestamp" }).default(
  //   sql`(current_timestamp)` // Default to current timestamp
  // ), // Use integer for timestamp
});

export const broadcastLists = sqliteTable("broadcast_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  broadcastId: integer("broadcast_id")
    .notNull()
    .references(() => broadcasts.id, { onDelete: "cascade" }), // Also add cascade here for consistency when deleting broadcasts
  listId: integer("list_id")
    .notNull()
    .references(() => messagingLists.id, { onDelete: "cascade" }), // Add cascade delete here
});

export type AuthCredsInsert = InferInsertModel<typeof authCredsTable>;
export type AuthKeysInsert = InferInsertModel<typeof authKeysTable>;
export type ChatsInsert = InferInsertModel<typeof chats>;
export type MessagesInsert = InferInsertModel<typeof messages>;

export type ListingsInsert = InferInsertModel<typeof listings>;
export type MessagingListsInsert = InferInsertModel<typeof messagingLists>;
export type MessagingListMembersInsert = InferInsertModel<
  typeof messagingListMembers
>;
export type BroadcastsInsert = InferInsertModel<typeof broadcasts>;
export type BroadcastListsInsert = InferInsertModel<typeof broadcastLists>;
