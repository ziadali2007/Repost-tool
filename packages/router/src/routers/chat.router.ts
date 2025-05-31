import { on } from "events";
import { ee } from "./router.base"; // Import shared instances
import { db } from "../db";
import { chats, ChatsInsert } from "../db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { tracked } from "@trpc/server";
import logger from "../lib/logger"; // Import the shared logger
import { t } from "../trpc";

export const chatRouter = t.router({
  onChats: t.procedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    logger.info(`Subscription started for chats for client ${ctx.clientId}`);

    // Yield previous chats
    const previousChats = await db
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.clientId, ctx.clientId),
          isNotNull(chats.lastMessageRecvTimestamp),
          // Numbers that are not in contacts are null
          isNotNull(chats.name),
        ),
      )
      .orderBy(desc(chats.lastMessageRecvTimestamp))
      .limit(100); // Keep limit reasonable

    logger.debug(
      `Yielding ${previousChats.length} previous chats for ${ctx.clientId}`,
    );
    for (const chat of previousChats.reverse()) {
      // reverse to send oldest first
      yield tracked(chat.id, chat);
    }

    // Listen for new chat events
    for await (const [data] of on(ee, "chats", { signal })) {
      if (ctx.clientId !== data.clientId) {
        continue;
      }
      logger.debug(
        `Received ${data.chats.length} new/updated chats via event for ${ctx.clientId}`,
      );
      for (const chat of data.chats as ChatsInsert[]) {
        yield tracked(chat.id, chat);
      }
    }
    logger.info(`Subscription ended for chats for client ${ctx.clientId}`);
  }),
});
