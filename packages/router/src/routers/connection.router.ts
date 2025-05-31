import { on } from "events";
import { ee, openSockets, groupCache } from "./router.base"; // Import shared instances
import { db } from "../db";
import { messages } from "../db/schema"; // Keep schema imports needed for getMessage
import { and, eq } from "drizzle-orm";
import makeWASocket, {
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidNewsletter,
} from "baileys";
import { mapDbMessageToWAMessage } from "../lib/mappings"; // Keep needed mappings
import { useDBAuthState } from "../lib/store";
import { bindSocketEvents, disconnect } from "../socket/handler";
import logger from "../lib/logger"; // Import the shared logger
import { t } from "../trpc";

export const connectionRouter = t.router({
  requestConnection: t.procedure.mutation(async ({ ctx }) => {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    const clientId = ctx.clientId; // Use local variable for clarity
    logger.info(`Client ${clientId} requested connection`);

    // const existingSocket = openSockets.get(clientId);
    // if (existingSocket) {
    //   logger.info(`Client ${clientId} is already connected or connecting.`);
    //   if (existingSocket.ws.isOpen) {
    //     logger.info(
    //       `Emitting 'connected' for already open socket: ${clientId}`
    //     );
    //     setTimeout(() => {
    //       ee.emit("connected", { clientId });
    //     }, 500);
    //     return { status: "already_connected" };
    //   } else {
    //     logger.info(
    //       `Socket exists but not open (state: ${existingSocket.ws.isClosed}), allowing reconnection attempt.`
    //     );
    //     try {
    //       existingSocket.end(undefined);
    //     } catch (e) {
    //       logger.warn(
    //         { err: e },
    //         `Error ending existing socket for ${clientId}`
    //       );
    //     }
    //     openSockets.delete(clientId);
    //   }
    // }

    logger.info(`Proceeding with new connection setup for ${clientId}`);
    const { state, saveCreds } = await useDBAuthState(clientId);

    const sock = makeWASocket({
      printQRInTerminal: false,
      logger: logger.child({ module: "baileys", clientId }), // Pass child logger to Baileys
      auth: state,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
      shouldIgnoreJid: (jid) =>
        isJidBroadcast(jid) ||
        isJidStatusBroadcast(jid) ||
        isJidNewsletter(jid),
      getMessage: async (key) => {
        // getMessage logic remains here as it's part of socket config
        const message = await db
          .select()
          .from(messages)
          .where(
            and(eq(messages.clientId, clientId), eq(messages.id, key.id ?? "")),
          )
          .get();
        return message
          ? (mapDbMessageToWAMessage(message)?.message ?? undefined)
          : undefined;
      },
    });

    openSockets.set(clientId, sock);
    logger.info(`Socket instance created and stored for ${clientId}`);

    bindSocketEvents(sock, clientId, saveCreds, ee);
    logger.info(`Socket events bound for ${clientId}`);

    return { status: "connecting" };
  }),

  onQrCode: t.procedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    for await (const [data] of on(ee, "qr", { signal })) {
      if (ctx.clientId !== data.clientId) {
        continue;
      }
      yield data.qr as string;
    }
  }),

  onRestart: t.procedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    for await (const [data] of on(ee, "restart", { signal })) {
      if (ctx.clientId !== data.clientId) {
        continue;
      }
      yield data.clientId as string;
    }
  }),

  onConnect: t.procedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    for await (const [data] of on(ee, "connected", { signal })) {
      if (ctx.clientId !== data.clientId) {
        continue;
      }
      yield data;
    }
  }),

  disconnect: t.procedure.mutation(async ({ ctx }) => {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    logger.info(`Disconnect requested for client ${ctx.clientId}`);
    // Call the imported disconnect function
    await disconnect(ctx.clientId);
    logger.info(`Disconnect process completed for client ${ctx.clientId}`);
    return { status: "ok" };
  }),

  onDisconnect: t.procedure.subscription(async function* ({ ctx, signal }) {
    if (!ctx.clientId) {
      throw new Error("Client ID is required");
    }
    for await (const [data] of on(ee, "disconnected", { signal })) {
      if (ctx.clientId !== data.clientId) {
        continue;
      }
      yield data.clientId as string;
    }
  }),
});
