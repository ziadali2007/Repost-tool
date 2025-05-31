import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@whatsapp-bot/router";

export const trpc = createTRPCReact<AppRouter>();
