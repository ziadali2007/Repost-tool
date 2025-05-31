import { AnyMessageContent, delay } from "baileys";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { messagingListMembers, broadcasts, broadcastLists } from "../db/schema";
import logger from "../lib/logger";
import { openSockets, ee } from "../routers/router.base";
import {
  BroadcastCompleteEvent,
  BroadcastProgressEvent,
} from "../routers/broadcast.router";

const BROADCAST_PROGRESS_EVENT = "broadcast:progress";
const BROADCAST_COMPLETE_EVENT = "broadcast:complete";

// Helper function for random delay (jitter)
const randomDelay = (minMs: number, maxMs: number) =>
  delay(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);

/**
 * We can't use the tRPC router directly here because we need to handle
 * image uploads, so we export the procedure as a function to later handle it from
 * the server as HTTP.
 */
export async function sendMessageProcedure(
  clientId: string,
  content: string,
  listIds: number[],
  file?: Buffer // Changed to optional single Buffer
) {
  if (!clientId) {
    throw new Error("Client ID is required");
  }
  const ownerNumber = clientId; // Using clientId as ownerNumber for now

  logger.info(
    `Processing broadcast request for client ${clientId} to lists [${listIds.join(
      ", "
    )}]${file ? " with an image" : ""}.` // Updated log message
  );

  // 1. Fetch members (remoteJids) for each listId from the database.
  const members = await db
    .select({ remoteJid: messagingListMembers.remoteJid })
    .from(messagingListMembers)
    .where(
      and(
        eq(messagingListMembers.clientId, clientId),
        inArray(messagingListMembers.listId, listIds)
      )
    );

  if (members.length === 0) {
    logger.warn(`No members found for lists [${listIds.join(", ")}]`);
    return {
      success: false, // Indicate no action taken
      message: "No members found in selected lists.",
      broadcastId: null,
      recipients: [],
    };
  }

  // 2. Deduplicate remoteJids
  const uniqueJids = [...new Set(members.map((m) => m.remoteJid))];
  logger.info(`Found ${uniqueJids.length} unique recipients for broadcast.`);

  // 3. Get the Baileys socket
  const sock = openSockets.get(clientId);
  if (!sock) {
    logger.error(`Socket not found for client ${clientId}`);
    throw new Error("WhatsApp connection not active. Please reconnect.");
  }

  // 5. Store broadcast history (do this before sending)
  let broadcastId: number | undefined;
  try {
    const [insertedBroadcast] = await db
      .insert(broadcasts)
      .values({
        ownerNumber, // Use clientId or actual owner number if available
        content,
      })
      .returning({ id: broadcasts.id });

    broadcastId = insertedBroadcast.id;

    if (broadcastId) {
      const broadcastListValues = listIds.map((listId) => ({
        broadcastId: broadcastId!,
        listId: listId,
      }));
      await db.insert(broadcastLists).values(broadcastListValues);
      logger.info(`Recorded broadcast ID ${broadcastId}`);
    } else {
      throw new Error("Failed to get broadcast ID after insertion.");
    }
  } catch (dbError) {
    console.error(dbError);
    logger.error("Failed to record broadcast history:", dbError);
    throw new Error("Failed to initiate broadcast history."); // Throw error if recording fails
  }

  // 3. Send messages with jitter/delay
  let successCount = 0;
  let errorCount = 0;
  const errors: { jid: string; error: string }[] = [];

  // Don't await the loop itself, let it run in the background
  (async () => {
    let successCount = 0;
    let errorCount = 0;
    const currentBroadcastId = broadcastId!; // Use the definite ID

    for (const jid of uniqueJids) {
      // Emit 'sending' status
      ee.emit(BROADCAST_PROGRESS_EVENT, {
        broadcastId: currentBroadcastId,
        clientId,
        jid,
        status: "sending",
        timestamp: Date.now(),
      } as BroadcastProgressEvent);

      try {
        logger.debug(`Sending message to ${jid} for client ${clientId}`);

        let messageToSend: AnyMessageContent;

        if (file) {
          // Send image with caption
          messageToSend = {
            image: file,
            caption: content,
            // You might need mimetype here depending on Baileys version/usage
            // mimetype: 'image/jpeg' // Or determine dynamically if needed
          };
        } else {
          // Send plain text message
          messageToSend = { text: content };
        }

        await sock.sendMessage(jid, messageToSend);

        successCount++;
        // Emit 'sent' status
        ee.emit(BROADCAST_PROGRESS_EVENT, {
          broadcastId: currentBroadcastId,
          clientId,
          jid,
          status: "sent",
          timestamp: Date.now(),
        } as BroadcastProgressEvent);
        await randomDelay(200, 3000); // Delay after successful send
      } catch (error: any) {
        logger.error(`Failed to send message to ${jid}: ${error.message}`);
        errorCount++;
        // Emit 'error' status
        ee.emit(BROADCAST_PROGRESS_EVENT, {
          broadcastId: currentBroadcastId,
          clientId,
          jid,
          status: "error",
          error: error.message || "Unknown error",
          timestamp: Date.now(),
        } as BroadcastProgressEvent);
        await delay(500); // Shorter delay on error
      }
    }

    // Emit completion event
    const completionStatus =
      errorCount === 0 ? "completed" : "completed_with_errors";

    ee.emit(BROADCAST_COMPLETE_EVENT, {
      broadcastId: currentBroadcastId,
      clientId,
      status: completionStatus,
      successCount,
      errorCount,
      timestamp: Date.now(),
    } as BroadcastCompleteEvent);

    logger.info(
      `Broadcast ID ${currentBroadcastId} finished for client ${clientId}. Status: ${completionStatus}, Success: ${successCount}, Errors: ${errorCount}`
    );
  })(); // Immediately invoke the async function

  // Return immediately with broadcastId and initial recipients
  return {
    success: true,
    message: `Broadcast ${broadcastId} started to ${uniqueJids.length} recipients.`,
    broadcastId: broadcastId,
    recipients: uniqueJids, // Send the list of JIDs to the client
  };
}
