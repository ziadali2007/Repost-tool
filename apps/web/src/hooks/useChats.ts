import { trpc } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const useChats = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chats"],
    initialData: [] as any[],
  });

  trpc.chat.onChats.useSubscription(undefined, {
    onData: (chat) => {
      // Use ChatData type
      if (chat) {
        qc.setQueryData(["chats"], (prevChats: any) => {
          const chatIndex =
            prevChats?.findIndex((c: any) => c.id === chat.id) ?? -1;
          if (chatIndex > -1) {
            // Update existing chat
            const updatedChats = [...(prevChats ?? [])];
            updatedChats[chatIndex] = chat;
            return updatedChats;
          } else {
            // Add new chat
            console.log("New chat data:", chat);
            return [...prevChats, chat].sort(
              (a, b) =>
                (b.lastMessageRecvTimestamp || 0) -
                (a.lastMessageRecvTimestamp || 0),
            ); // Keep sorted by recent message
          }
        });
      }
    },
  });

  return query;
};
