import { useState, useMemo } from "react"; // Import useMemo
import "./App.css";
import { trpc } from "./lib/trpc"; // Import the tRPC client
import { createWSClient, wsLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Main } from "./components/Main";
import { Toaster } from "./components/ui/sonner";

// Function to get or create client ID
const getClientId = (): string => {
  let clientId = localStorage.getItem("clientId");
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem("clientId", clientId);
  }
  return clientId;
};

function App() {
  const clientId = useMemo(() => getClientId(), []); // Get client ID once

  // create persistent WebSocket connection with clientId
  const wsClient = useMemo(
    () =>
      createWSClient({
        url: `ws://localhost:3001`,
        connectionParams: {
          clientId: clientId, // Pass clientId in connectionParams
        },
      }),
    [clientId],
  );

  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        wsLink({
          client: wsClient,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Main />
        <Toaster />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
