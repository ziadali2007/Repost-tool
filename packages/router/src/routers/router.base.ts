import EventEmitter from "events";
import makeWASocket from "baileys";
import NodeCache from "node-cache";
import { chatRouter } from "./chat.router";
import { connectionRouter } from "./connection.router";
import { messageRouter } from "./message.router";
import { messagingListRouter } from "./messagingList.router";
import { broadcastRouter } from "./broadcast.router"; // Import the new broadcast router
import { t } from "../trpc";

// Shared Event Emitter
export const ee = new EventEmitter();

// Shared Cache for Group Metadata
export const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false }); // 5 min TTL

// Shared Map for Open Sockets
type Sock = Omit<ReturnType<typeof makeWASocket>, "onUnexpectedError">;
export const openSockets = new Map<string, Sock>();

// --- Main App Router ---

export const appRouter = t.router({
  // Connection setup remains here as it orchestrates socket creation

  // Merge the sub-routers
  connection: connectionRouter,
  message: messageRouter,
  chat: chatRouter,
  messagingList: messagingListRouter,
  broadcast: broadcastRouter, // Add the new broadcast router
});

// Export the main router type
export type AppRouter = typeof appRouter;
