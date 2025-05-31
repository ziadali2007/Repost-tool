import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code"; // Import QRCode component
import { Button } from "./ui/button";
import { MessagingLists } from "./MessagingLists"; // Import the new component
import { useChats } from "@/hooks/useChats";
import { LogOut, PlusCircle, SquarePen, User } from "lucide-react";
import { BroadcastProgressDisplay } from "./BroadcastProgressDisplay";
import { SendMessageForm } from "./SendMessageForm";
import { MessagingListForm } from "./MessagingListForm"; // Import MessagingListForm
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Import Dialog components
import type { Contact } from "baileys";
import { extractNumberFromJid } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ListDetails {
  id: number;
  name: string;
  description?: string | null;
  members: { remoteJid: string; name: string }[]; // Ensure members are included
  // Add other fields returned by getListDetails if necessary
}

// Add interface for basic list data needed by SendMessageForm
interface BasicList {
  id: number;
  name: string;
}

export const Main = () => {
  const {
    mutate: requestConnection,
    error,
    isPending: isConnecting,
  } = trpc.connection.requestConnection.useMutation();
  const { data: qrCode, reset: resetQr } =
    trpc.connection.onQrCode.useSubscription();
  const { data: clientId } = trpc.connection.onRestart.useSubscription();
  const { mutate: disconnect } = trpc.connection.disconnect.useMutation();

  const [isConnected, setIsConnected] = useState(false); // Track connection state
  const [user, setUser] = useState<Contact>(); // Track user state

  const [isManageListsDialogOpen, setIsManageListsDialogOpen] = useState(false); // State for Manage Lists dialog
  const [isListFormOpen, setIsListFormOpen] = useState(false); // State for Create/Edit List form
  const [listToEdit, setListToEdit] = useState<ListDetails | null>(null); // State for list being edited

  const { data: chats = [] } = useChats(); // Default to empty array

  trpc.connection.onConnect.useSubscription(undefined, {
    onData: (connected) => {
      if (connected) {
        console.log("Connected to WhatsApp");
        setIsConnected(true); // Set connection state to true
        setUser(connected.user);
      } else {
        console.log("Disconnected from WhatsApp");
        setIsConnected(false); // Set connection state to false
      }
    },
  });

  trpc.connection.onDisconnect.useSubscription(undefined, {
    onData: (clientId) => {
      if (clientId) {
        console.log("Disconnected client ID:", clientId);
        resetQr();
        setIsConnected(false); // Reset connection state
        // requestConnection(); // Request reconnection
      }
    },
  });

  useEffect(() => {
    requestConnection();
  }, [clientId, requestConnection]); // Add requestConnection to dependency array

  const [currentBroadcastId, setCurrentBroadcastId] = useState<number | null>(
    null
  );
  const [currentRecipients, setCurrentRecipients] = useState<string[]>([]);

  // Updated: Called by SendMessageForm on successful broadcast start
  const handleSendFormSuccess = (details: {
    broadcastId: number;
    recipients: string[];
  }) => {
    setCurrentBroadcastId(details.broadcastId);
    setCurrentRecipients(details.recipients);
  };

  // Callback for the BroadcastProgressDisplay clear button
  const handleClearProgress = () => {
    setCurrentBroadcastId(null);
    setCurrentRecipients([]);
  };

  // Handler to open the form for creating a new list
  const handleCreate = () => {
    setListToEdit(null); // Ensure no edit data is present
    setIsListFormOpen(true);
  };

  // Handler called by MessagingLists to open the form for editing
  const handleEditRequest = (list: ListDetails) => {
    setListToEdit(list);
    setIsListFormOpen(true);
    // setIsManageListsDialogOpen(false); // Close the manage dialog when opening edit form
  };

  // Handler called by MessagingListForm on successful save/create
  const handleListFormSuccess = () => {
    setIsListFormOpen(false);
    setListToEdit(null); // Clear edit state
    // Optionally re-open manage dialog if desired, or leave closed
    // setIsManageListsDialogOpen(true);
  };

  const {
    data: lists, // This data will be passed to SendMessageForm
    // error,
  } = trpc.messagingList.getLists.useQuery(undefined, { enabled: isConnected }); // Only fetch if connected

  const basicLists: BasicList[] =
    lists?.map((list) => ({ id: list.id, name: list.name })) ?? [];

  console.log("user", user, extractNumberFromJid(user?.id ?? ""));

  if (isConnecting) {
    return (
      <div className="flex gap-10 w-full h-screen justify-center items-center">
        <h3 className="text-2xl font-bold max-w-3xl">
          Connecting to WhatsApp...
        </h3>
      </div>
    );
  }

  if (qrCode && !isConnected) {
    return (
      <div className="flex gap-10 w-full h-screen justify-center items-center">
        <div className="flex justify-center">
          <QRCode value={qrCode} width={400} height={400} />
        </div>
        <div className="flex flex-col gap-2 max-w-2xl">
          <h3 className="text-4xl font-bold">Share your watches in seconds</h3>
          <p className="text-lg text-muted-foreground">
            Easily update your dealers, clients, and groups about new stock,
            requests, and available models — all with one click.
          </p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1">
            <li>Open WhatsApp on your phone.</li>
            <li>Tap Menu on Android or Settings on iPhone.</li>
            <li>Tap Linked Devices and then Link a device.</li>
            <li>Point your phone at this screen to scan the QR code.</li>
          </ol>
        </div>
      </div>
    );
  }

  // Prepare chats data for the form (simplified structure)
  const availableChatsForForm = chats.map((chat) => ({
    id: chat.id,
    name: chat.data.name,
  }));

  return (
    <div className="flex flex-col md:flex-row w-full h-screen bg-background">
      {error && <div className="p-4 text-red-500">{error.message}</div>}

      {/* Main Content Area */}
      <div className="w-full md:w-3/4 h-full mx-auto p-4 flex flex-col">
        {isConnected ? (
          <>
            {/* Buttons and Forms Area */}
            <div className="flex justify-end w-full py-4 gap-2">
              {/* Create New List Button */}
              <Button onClick={handleCreate}>
                <PlusCircle className="h-4 w-4" />
                Create New List
              </Button>
              {/* Manage Lists Dialog Trigger */}
              <Dialog
                open={isManageListsDialogOpen}
                onOpenChange={setIsManageListsDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <SquarePen />
                    Manage Lists
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Manage Lists</DialogTitle>
                  </DialogHeader>
                  {/* Render MessagingLists inside the dialog */}
                  <div className="overflow-y-auto flex-grow pr-2">
                    <MessagingLists
                      availableChats={availableChatsForForm}
                      onEditRequest={handleEditRequest} // Pass handler to trigger edit form
                    />
                  </div>
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size={"icon"}>
                    <User />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>
                    <h6>{user?.name}</h6>
                    <p className="text-sm text-muted-foreground">
                      {extractNumberFromJid(user?.id ?? "")}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {/* <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Billing</DropdownMenuItem>
                  <DropdownMenuItem>Team</DropdownMenuItem> */}
                  <DropdownMenuItem
                    className="text-destructive cursor-pointer hover:text-destructive"
                    onClick={() => {
                      disconnect();
                    }}
                  >
                    <LogOut className="text-destructive" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Render SendMessageForm directly */}
            <SendMessageForm
              availableLists={basicLists}
              onSuccess={handleSendFormSuccess}
            />

            {/* Render BroadcastProgressDisplay directly */}
            <BroadcastProgressDisplay
              broadcastId={currentBroadcastId}
              initialRecipients={currentRecipients}
              onClear={handleClearProgress} // Pass the clear handler
              availableChats={availableChatsForForm} // Pass available chats
            />

            {/* Optional: Placeholder */}
            <div className="flex-grow flex items-center justify-center text-muted-foreground">
              {/* Placeholder content if needed */}
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center text-muted-foreground">
            Please connect to manage messaging lists and send broadcasts.
          </div>
        )}
      </div>

      {/* Render MessagingListForm (controlled by Main) */}
      <MessagingListForm
        isOpen={isListFormOpen}
        onOpenChange={setIsListFormOpen}
        listToEdit={listToEdit}
        availableChats={availableChatsForForm}
        onSuccess={handleListFormSuccess}
      />

      {/* Disconnect Button */}
      {/* {isConnected && (
        <div className="mt-auto pt-4 fixed bottom-5 w-full md:w-3/4 flex justify-end left-1/2 -translate-x-1/2 bg-background border-t border-muted p-4 items-end h-min">
          <Button
            onClick={() => disconnect()}
            variant="destructive"
            disabled={isPending}
          >
            {isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      )} */}
    </div>
  );
};
