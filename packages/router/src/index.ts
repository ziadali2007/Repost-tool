import { sendMessageProcedure } from "./procedures/sendMessage.procedure";
import type { AppRouter as AppRouterImport } from "./routers/router.base";
import { appRouter } from "./routers/router.base";

export type AppRouter = AppRouterImport;
export { appRouter, sendMessageProcedure };
