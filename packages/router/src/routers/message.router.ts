import { on } from "events";
import { z } from "zod";
import { db } from "../db";
import { messages, MessagesInsert } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { tracked } from "@trpc/server";
import { ee } from "./router.base";
import logger from "../lib/logger";
import { t } from "../trpc";

export const messageRouter = t.router({
  onMessage: t.procedure
    .input(
      z
        .object({
          lastEventId: z.string().nullish(),
        })
        .optional(),
    )
    .subscription(async function* ({ ctx, signal, input }) {
      if (!ctx.clientId) {
        throw new Error("Client ID is required");
      }
      logger.info(
        `Subscription started for messages for client ${ctx.clientId}`,
      );

      // Yield previous messages (consider pagination or limiting)
      const previousMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.clientId, ctx.clientId)))
        .orderBy(desc(messages.messageTimestamp))
        .limit(100); // Keep limit reasonable

      logger.debug(
        `Yielding ${previousMessages.length} previous messages for ${ctx.clientId}`,
      );
      for (const message of previousMessages.reverse()) {
        // reverse to send oldest first
        yield tracked(message.id, message);
      }

      // Listen for new messages
      for await (const [data] of on(ee, "message", { signal })) {
        if (ctx.clientId !== data.clientId) {
          continue;
        }

        logger.debug(
          `Received ${data.messages.length} new messages via event for ${ctx.clientId}`,
        );
        for (const message of data.messages as MessagesInsert[]) {
          yield tracked(message.id, message);
        }
      }
      logger.info(`Subscription ended for messages for client ${ctx.clientId}`);
    }),
});
