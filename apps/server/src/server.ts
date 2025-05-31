import "dotenv/config";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import ws from "ws";
import { appRouter, sendMessageProcedure } from "@whatsapp-bot/router";
import { createContext } from "./context";
import logger from "./lib/logger"; // Import the shared logger
import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";

const PORT = 3001; // Choose a port for the WebSocket server
const HTTP_PORT = 3000; // Choose a port for the HTTP server

logger.info("Starting WebSocket server...");

const wss = new ws.Server({
  port: PORT,
});

const app = express();

app.use(cors());
app.use(express.json());

const m = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
  },
  fileFilter: (req, file, cb) => {
    // Add file filter for images
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

const schema = z.object({
  clientId: z.string(),
  content: z.string(),
  listIds: z.string().transform((val) => JSON.parse(val)), // Parse JSON string to array
});

// Use upload.single('file') instead of upload.array('files', 5)
app.post("/api/broadcast", m.single("file"), async (req, res) => {
  const data = schema.safeParse(req.body);
  if (!data.success) {
    logger.error(data.error, "Invalid request data");
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  // Access single file via req.file (optional)
  const file = req.file as Express.Multer.File | undefined;

  const { clientId, content, listIds } = data.data;

  // Pass the single file buffer if it exists, otherwise undefined or empty array
  const fileBuffer = file ? file.buffer : undefined;

  try {
    const resp = await sendMessageProcedure(
      clientId,
      content,
      listIds,
      fileBuffer // Pass single buffer or undefined
    );
    res.status(200).json(resp);
  } catch (error: any) {
    logger.error({ err: error }, "Error calling sendMessageProcedure");
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process broadcast request.",
    });
  }
});

app.listen(HTTP_PORT, () => {
  logger.info(`🌐 HTTP Server listening on http://localhost:${HTTP_PORT}`);
});

const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext,
  // Optional: Keep-alive pings
  keepAlive: {
    enabled: true,
    pingMs: 30000,
    pongWaitMs: 5000,
  },
});

wss.on("connection", (ws) => {
  // Note: We don't have clientId here yet, it comes via connectionParams
  logger.info(`➕➕ Connection opened (${wss.clients.size})`);
  ws.once("close", (code, reason) => {
    // We still don't have easy access to clientId on close here
    logger.info(
      `➖➖ Connection closed (${wss.clients.size}). Code: ${code}, Reason: ${reason}`
    );
  });
  ws.on("error", (error) => {
    logger.error({ err: error }, "WebSocket error on connection");
  });
});

logger.info(`✅ WebSocket Server listening on ws://localhost:${PORT}`);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  handler.broadcastReconnectNotification();
  wss.close(() => {
    logger.info("WebSocket server closed.");
    // Add any other cleanup logic here if needed
    process.exit(0); // Ensure process exits cleanly
  });
});
