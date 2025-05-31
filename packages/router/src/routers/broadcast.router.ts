import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { broadcasts, broadcastLists, messagingListMembers } from "../db/schema";
import { t } from "../trpc";
import logger from "../lib/logger";
import { openSockets, ee } from "./router.base"; // Import openSockets AND ee
import { delay, AnyMessageContent } from "baileys";
import { on } from "events"; // Import on from events

// Define event payload types
export type BroadcastProgressEvent = {
  broadcastId: number;
  clientId: string;
  jid: string;
  status: "sending" | "sent" | "error";
  error?: string;
  timestamp: number;
};

export type BroadcastCompleteEvent = {
  broadcastId: number;
  clientId: string;
  status: "completed" | "completed_with_errors";
  successCount: number;
  errorCount: number;
  timestamp: number;
};

const BROADCAST_PROGRESS_EVENT = "broadcast:progress";
const BROADCAST_COMPLETE_EVENT = "broadcast:complete";

export const broadcastRouter = t.router({
  // Subscription for broadcast progress
  onBroadcastProgress: t.procedure
    .input(z.object({ broadcastId: z.number() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const { broadcastId } = input;
      const clientId = ctx.clientId;

      for await (const [data] of on(ee, BROADCAST_PROGRESS_EVENT, {
        signal,
      })) {
        if (data.broadcastId === broadcastId && data.clientId === clientId) {
          logger.debug(
            `Broadcast progress event for ${clientId}: ${data.status} to ${data.jid}`
          );
          yield data as BroadcastProgressEvent;
        }
      }

      logger.info(
        `Client ${clientId} subscribed to progress for broadcast ${broadcastId} (Client filter temporarily disabled)`
      );
    }),

  // Subscription for broadcast completion
  onBroadcastComplete: t.procedure
    .input(z.object({ broadcastId: z.number() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const { broadcastId } = input;
      const clientId = ctx.clientId;

      for await (const [data] of on(ee, BROADCAST_COMPLETE_EVENT, {
        signal,
      })) {
        if (data.broadcastId === broadcastId && data.clientId === clientId) {
          yield data as BroadcastCompleteEvent;
        }
      }

      logger.info(
        `Client ${clientId} subscribed to completion for broadcast ${broadcastId} (Client filter temporarily disabled)`
      );
    }),
});

export type BroadcastRouter = typeof broadcastRouter;
