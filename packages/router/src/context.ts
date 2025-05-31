import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

export const createContext = async ({
  req,
  info,
}: CreateWSSContextFnOptions) => {
  const clientId = info.connectionParams?.clientId as string | null; // Extract clientId from connectionParams
  return {
    clientId: clientId, // Add clientId to the context
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
