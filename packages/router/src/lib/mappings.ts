import { Chat, WAMessage } from "baileys";
import type { ChatsInsert, MessagesInsert } from "../db/schema";

function num(val: any): number | null {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === "number") {
    return val;
  }
  return val.toInt();
}

export function mapChatToDb(chat: Chat, clientId: string): ChatsInsert {
  return {
    clientId: clientId,
    id: chat.id,
    messages: chat.messages, // Assuming messages is stored as JSON
    newJid: chat.newJid,
    oldJid: chat.oldJid,
    lastMsgTimestamp: num(chat.lastMsgTimestamp),
    unreadCount: chat.unreadCount,
    readOnly: chat.readOnly,
    endOfHistoryTransfer: chat.endOfHistoryTransfer,
    ephemeralExpiration: chat.ephemeralExpiration,
    ephemeralSettingTimestamp: num(chat.ephemeralSettingTimestamp),
    endOfHistoryTransferType: chat.endOfHistoryTransferType,
    conversationTimestamp: num(chat.conversationTimestamp),
    name: chat.name,
    pHash: chat.pHash,
    notSpam: chat.notSpam,
    archived: chat.archived,
    disappearingMode: chat.disappearingMode, // Assuming stored as JSON
    unreadMentionCount: chat.unreadMentionCount,
    markedAsUnread: chat.markedAsUnread,
    participant: chat.participant, // Assuming stored as JSON
    tcToken: chat.tcToken ? Buffer.from(chat.tcToken).toString("base64") : null,
    tcTokenTimestamp: num(chat.tcTokenTimestamp),
    contactPrimaryIdentityKey: chat.contactPrimaryIdentityKey
      ? Buffer.from(chat.contactPrimaryIdentityKey).toString("base64")
      : null,
    pinned: chat.pinned,
    muteEndTime: num(chat.muteEndTime),
    shareOwnPn: chat.shareOwnPn,
    pnhDuplicateLidThread: chat.pnhDuplicateLidThread,
    lidJid: chat.lidJid,
    lastMessageRecvTimestamp: chat.lastMessageRecvTimestamp,
  };
}

// Return type can be MessageInsert or null if essential key info is missing
export function mapMessageToDb(
  msg: WAMessage,
  clientId: string,
): MessagesInsert | null {
  const key = msg.key;
  if (!key || !key.id || !key.remoteJid) {
    // Essential information missing, cannot insert
    return null;
  }

  return {
    clientId: clientId,
    id: key.id,
    remoteJid: key.remoteJid,
    fromMe: key.fromMe,
    participant: key.participant,
    message: msg.message, // Store the whole message object as JSON
    messageTimestamp: num(msg.messageTimestamp),
    status: msg.status,
    pushName: msg.pushName,
    broadcast: msg.broadcast,
    starred: msg.starred,
    messageStubType: msg.messageStubType,
    messageStubParameters: msg.messageStubParameters, // Store as JSON
    labels: msg.labels, // Store as JSON
    userReceipt: msg.userReceipt, // Store as JSON
    reactions: msg.reactions, // Store as JSON
    mediaData: msg.mediaData, // Store as JSON
    pollUpdates: msg.pollUpdates, // Store as JSON
    messageSecret: msg.messageSecret
      ? Buffer.from(msg.messageSecret).toString("base64")
      : null,
    pinInChat: msg.pinInChat, // Store as JSON
    chatId: key.remoteJid, // Foreign key: chat's JID
  };
}

// Helper function to convert base64 string back to Uint8Array
function base64ToUint8Array(
  base64String: string | null | undefined,
): Uint8Array | undefined {
  if (!base64String) return undefined;
  try {
    // In Node.js environment
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64String, "base64");
    }
    // In Browser environment (less likely for server-side)
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Failed to decode base64 string:", e);
    return undefined;
  }
}

// Helper function to convert number back to Long or number
// Note: Direct conversion back to Long might lose precision if not stored carefully.
// Sticking to 'number' is often sufficient unless Long precision is critical.
function numToTimestamp(
  value: number | null | undefined,
): number | null | undefined {
  // If you need Long, you might need to store timestamps differently or accept potential precision loss.
  // return value !== null && value !== undefined ? Long.fromNumber(value) : value;
  return value;
}

// Return type should ideally be WAMessage, but using 'any' for flexibility
// if the exact DB retrieval type differs slightly from MessagesInsert
export function mapDbMessageToWAMessage(
  dbMsg: MessagesInsert, // Or the actual type returned by your DB query
): WAMessage | null {
  if (!dbMsg.id || !dbMsg.remoteJid) {
    // Essential key information missing
    return null;
  }

  // Assuming dbMsg fields like 'message', 'fromMe', 'broadcast', etc.,
  // are already correctly typed (object/boolean) after DB retrieval.
  const waMessage = {
    key: {
      remoteJid: dbMsg.remoteJid,
      fromMe: dbMsg.fromMe ?? undefined, // Directly use boolean
      id: dbMsg.id,
      participant: dbMsg.participant ?? undefined, // Use ?? for null/undefined check
    },
    message: dbMsg.message ?? undefined, // Directly use parsed JSON object
    messageTimestamp: numToTimestamp(dbMsg.messageTimestamp),
    status: dbMsg.status ?? undefined, // Assuming status is nullable number
    pushName: dbMsg.pushName ?? undefined,
    broadcast: dbMsg.broadcast ?? undefined, // Directly use boolean
    // Optional fields: handle potential null/undefined from DB
    starred: dbMsg.starred ?? undefined, // Directly use boolean
    messageStubType: dbMsg.messageStubType ?? undefined,
    messageStubParameters: dbMsg.messageStubParameters ?? undefined, // Directly use parsed JSON object
    labels: dbMsg.labels ?? undefined, // Directly use parsed JSON object
    userReceipt: dbMsg.userReceipt ?? undefined, // Directly use parsed JSON object
    reactions: dbMsg.reactions ?? undefined, // Directly use parsed JSON object
    mediaData: dbMsg.mediaData ?? undefined, // Directly use parsed JSON object
    pollUpdates: dbMsg.pollUpdates ?? undefined, // Directly use parsed JSON object
    messageSecret: base64ToUint8Array(dbMsg.messageSecret),
    pinInChat: dbMsg.pinInChat ?? undefined, // Directly use parsed JSON object
    // Note: 'chatId' is a helper field for DB relation, not part of WAMessage itself
    // 'isAnalyzed' is also a custom DB field
  };

  // Clean up undefined fields if necessary, although Baileys might handle them
  return waMessage as WAMessage;
}
