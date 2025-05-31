import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Edit } from "lucide-react"; // Remove PlusCircle if Create button is removed
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// Define the shape of a chat expected by the form
interface Chat {
  id: string; // remoteJid
  name: string | null;
}

interface MessagingListsProps {
  availableChats: Chat[]; // Pass available chats from Main
  onEditRequest: (list: ListDetails) => void; // Callback to request editing a list
}

// Define the shape of the list details expected from the backend
// Ensure this matches the return type of `getListDetails`
interface ListDetails {
  id: number;
  name: string;
  description?: string | null;
  members: { remoteJid: string; name: string }[]; // Ensure members are included
  // Add other fields returned by getListDetails if necessary
}

export function MessagingLists({ onEditRequest }: MessagingListsProps) {
  const [listToDelete, setListToDelete] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const {
    data: lists, // This data will be passed to SendMessageForm
    isLoading,
    error,
  } = trpc.messagingList.getLists.useQuery();

  const deleteMutation = trpc.messagingList.deleteList.useMutation({
    onSuccess: () => {
      toast("Success", {
        description: `List deleted successfully.`,
      });
      utils.messagingList.getLists.invalidate(); // Refetch lists
      setListToDelete(null); // Close confirmation dialog
    },
    onError: (error) => {
      toast("Error", {
        description: `Failed to delete list: ${error.message}`,
      });
      setListToDelete(null);
    },
  });

  // Modified handler for editing a list
  const handleEdit = async (listId: number) => {
    try {
      // Fetch details directly using the tRPC client from utils
      const details = await utils.client.messagingList.getListDetails.query({
        id: listId,
      });

      if (!details) {
        throw new Error("Could not fetch list details.");
      }

      // Call the callback prop passed from Main to handle opening the form
      onEditRequest(details as ListDetails);
    } catch (err: any) {
      toast("Error", {
        description: `Failed to fetch list details: ${
          err.message || "Unknown error"
        }`,
      });
      // No need to clear local edit state as it's managed in Main
    }
  };

  const handleDeleteConfirm = (listId: number) => {
    setListToDelete(listId);
  };

  const handleDelete = () => {
    if (listToDelete !== null) {
      deleteMutation.mutate({ id: listToDelete });
    }
  };

  if (isLoading) return <div>Loading lists...</div>;
  if (error) return <div>Error loading lists: {error.message}</div>;

  // Removed the outer div wrapper, adjust padding/margins in parent if needed
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists && lists.length > 0 ? (
            lists.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="font-medium">{list.name}</TableCell>
                <TableCell>{list.description || "-"}</TableCell>
                <TableCell className="text-right">
                  {/* Edit Button - Calls modified handleEdit */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(list.id)}
                    className="mr-2"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteConfirm(list.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                No messaging lists found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Remove List Form Dialog rendering */}
      {/* <MessagingListForm ... /> */}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={listToDelete !== null}
        onOpenChange={() => setListToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              messaging list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setListToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
