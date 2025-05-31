import makeWASocket, {
  DisconnectReason,
  WAMessage,
  isJidBroadcast,
  isJidNewsletter,
  isJidStatusBroadcast,
} from "baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";
import { BatchItem } from "drizzle-orm/batch";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  authCredsTable,
  authKeysTable,
  chats,
  ChatsInsert,
  messages,
  MessagesInsert,
} from "../db/schema";
import { conflictUpdateAllExcept } from "../db/utils";
import { mapChatToDb, mapMessageToDb } from "../lib/mappings";
import { ee, groupCache, openSockets } from "../routers/router.base"; // Import shared instances
import { chunk } from "lodash";
import logger from "../lib/logger"; // Import the shared logger

type Sock = ReturnType<typeof makeWASocket>;
type SaveCredsFunction = () => Promise<void>;

// Helper function for filtering messages
function isReadableMessage(message: WAMessage): boolean {
  return !message.message?.protocolMessage;
}

// Disconnect and cleanup logic
export async function disconnect(clientId: string) {
  const openSocket = openSockets.get(clientId);

  if (openSocket) {
    logger.info(`Client ${clientId} socket found, ending connection.`);
    try {
      await openSocket.logout();
    } catch (e) {
      logger.warn({ err: e }, `Logout failed for ${clientId}, forcing end`);
      openSocket.end(undefined);
    } finally {
      openSockets.delete(clientId);
      logger.info(`Socket removed for ${clientId}.`);
    }
  } else {
    logger.info(`No active socket found for ${clientId} during disconnect.`);
  }

  logger.info(`Cleaning up database for ${clientId}...`);
  await db.transaction(async (tx) => {
    if (!clientId) {
      // This should ideally not happen if called correctly, but good to check
      logger.error("Client ID is required for cleanup but was not provided.");
      throw new Error("Client ID is required for cleanup");
    }
    await tx.delete(authKeysTable).where(eq(authKeysTable.clientId, clientId));
    await tx
      .delete(authCredsTable)
      .where(eq(authCredsTable.clientId, clientId));
    await tx.delete(chats).where(eq(chats.clientId, clientId));
    await tx.delete(messages).where(eq(messages.clientId, clientId));
    logger.info(`Database cleanup complete for ${clientId}.`);
  });

  ee.emit("disconnected", { clientId: clientId });
}

// Function to bind all event listeners to the socket
export function bindSocketEvents(
  sock: Sock,
  clientId: string,
  saveCreds: SaveCredsFunction,
  ee: EventEmitter,
) {
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    logger.info(
      { connection, qr: !!qr, lastDisconnect },
      `Connection update for ${clientId}`,
    );

    if (qr) {
      logger.info(`QR code received for ${clientId}`);
      ee.emit("qr", { clientId, qr });
    }

    if (connection === "open") {
      logger.info(`Connection opened for ${clientId}`);
      openSockets.set(clientId, sock);
      ee.emit("connected", { clientId, user: sock.user });
    } else if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const error = lastDisconnect?.error;
      logger.warn({ statusCode, error }, `Connection closed for ${clientId}.`);

      openSockets.delete(clientId);
      logger.info(`Socket removed from map for ${clientId}`);

      if (statusCode === DisconnectReason.loggedOut) {
        logger.info(`Client ${clientId} logged out. Cleaning up.`);
        await disconnect(clientId);
        ee.emit("logged_out", { clientId });
      } else if (
        statusCode !== DisconnectReason.connectionClosed &&
        statusCode !== DisconnectReason.connectionReplaced &&
        statusCode !== DisconnectReason.loggedOut
      ) {
        logger.warn(
          `Connection closed unexpectedly for ${clientId}, emitting restart.`,
        );
        ee.emit("restart", { clientId });
      } else {
        logger.info(
          `Connection closed for ${clientId} due to manual action or replacement. No automatic restart triggered.`,
        );
        ee.emit("disconnected", { clientId });
      }
    }
  });

  sock.ev.on("groups.update", async (updates) => {
    logger.debug(`Received ${updates.length} group updates for ${clientId}`);
    for (const update of updates) {
      if (!update.id) continue;
      try {
        const metadata = await sock.groupMetadata(update.id);
        groupCache.set(update.id, metadata);
        logger.debug(`Updated group metadata cache for ${update.id}`);
        // ee.emit("group_update", { clientId, update }); // Optional: emit if needed
      } catch (error) {
        logger.error(
          { err: error, groupId: update.id },
          `Failed to get group metadata`,
        );
      }
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    logger.debug({ event }, `Group participants update for ${clientId}`);
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
      logger.debug(
        `Updated group metadata cache after participants update for ${event.id}`,
      );
      // ee.emit("group_participants_update", { clientId, event }); // Optional: emit if needed
    } catch (error) {
      logger.error(
        { err: error, event },
        `Failed to get group metadata after participants update`,
      );
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const { messages: msgs } = m;

    const mapped = msgs
      .filter((msg): msg is WAMessage => !!msg.key.id)
      .filter(isReadableMessage)
      .map((msg) => mapMessageToDb(msg, clientId))
      .filter((m): m is MessagesInsert => m !== null);

    if (mapped.length) {
      logger.debug(
        `Received ${mapped.length} readable messages for ${clientId}`,
      );
      try {
        await db
          .insert(messages)
          .values(mapped)
          .onConflictDoUpdate({
            target: messages.id,
            set: conflictUpdateAllExcept(messages, ["id", "clientId"]),
          });
        ee.emit("message", { clientId, messages: mapped });
        logger.debug(
          `Processed and emitted ${mapped.length} messages for ${clientId}`,
        );
      } catch (error) {
        logger.error({ err: error }, `Error saving messages for ${clientId}`);
      }
    }
  });

  sock.ev.on("chats.upsert", async (chts) => {
    const mapped = chts
      .filter((chat) => chat.id && chat.id.length > 0)
      .map((chat) => mapChatToDb(chat, clientId));

    if (mapped.length) {
      logger.debug(`Received ${mapped.length} chat upserts for ${clientId}`);
      try {
        await db
          .insert(chats)
          .values(mapped)
          .onConflictDoUpdate({
            target: chats.id,
            set: conflictUpdateAllExcept(chats, ["id", "clientId"]),
          });
        ee.emit("chats", { clientId, chats: mapped });
        logger.debug(
          `Processed and emitted ${mapped.length} chats for ${clientId}`,
        );
      } catch (error) {
        logger.error({ err: error }, `Error saving chats for ${clientId}`);
      }
    }
  });

  sock.ev.on(
    "messaging-history.set",
    async ({ chats: receivedChats, messages: receivedMessages }) => {
      logger.info(
        `Received history: ${receivedChats.length} chats, ${receivedMessages.length} messages for ${clientId}`,
      );
      const batchOps: BatchItem<"sqlite">[] = [];

      const chatValues = receivedChats
        .map((chat) => mapChatToDb(chat, clientId))
        .filter((c): c is ChatsInsert => c !== null);
      if (chatValues.length > 0) {
        for (const c of chatValues) {
          batchOps.push(
            db
              .insert(chats)
              .values(c)
              .onConflictDoUpdate({
                target: chats.id,
                set: conflictUpdateAllExcept(chats, ["id", "clientId"]),
              }),
          );
        }
      }

      const messageValues = receivedMessages
        .filter((msg) => msg.key.remoteJid !== "status@broadcast")
        .map((msg) => mapMessageToDb(msg, clientId))
        .filter((m): m is MessagesInsert => m !== null);
      if (messageValues.length > 0) {
        for (const message of messageValues) {
          batchOps.push(
            db
              .insert(messages)
              .values(message)
              .onConflictDoUpdate({
                target: messages.id,
                set: conflictUpdateAllExcept(messages, ["id", "clientId"]),
              }),
          );
        }
      }

      if (batchOps.length > 0) {
        try {
          logger.info(
            `Executing batch of ${batchOps.length} operations for history sync (${clientId})`,
          );

          const chunkedOps = chunk(batchOps, 100); // Keep chunking
          for (const chunk of chunkedOps) {
            logger.debug(
              `Executing chunk of ${chunk.length} operations for history sync (${clientId})`,
            );
            await db.batch(chunk as any);
          }

          logger.info(`Batch history sync successful for ${clientId}`);

          // Emit events *after* successful DB operation
          if (chatValues.length > 0) {
            const filtered = chatValues.filter((chat) => !!chat.name);
            ee.emit("chats", { clientId, chats: filtered });
          }
          if (messageValues.length > 0) {
            ee.emit("message", { clientId, messages: messageValues });
          }
        } catch (error) {
          logger.error(
            { err: error },
            `Error during batch history sync for ${clientId}`,
          );
        }
      } else {
        logger.info(`No history operations to batch for ${clientId}`);
      }
    },
  );
}
