import { useState, useEffect } from "react";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Define the shape of a chat expected by this form
interface Chat {
  id: string; // remoteJid
  name: string | null;
}

// Define the shape of a list member for editing/creating
interface ListMemberInput {
  remoteJid: string;
  name: string;
}

// Define the shape of the list data passed for editing
interface ListToEdit {
  id: number;
  name: string;
  description?: string | null;
  members: ListMemberInput[]; // Expect members array
}

interface MessagingListFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  listToEdit?: ListToEdit | null; // Use the detailed interface
  availableChats: Chat[];
  onSuccess: () => void;
}

const formSchema = z.object({
  name: z.string().min(1, "List name is required"),
  description: z.string().optional(),
});

export function MessagingListForm({
  isOpen,
  onOpenChange,
  listToEdit,
  availableChats,
  onSuccess,
}: MessagingListFormProps) {
  const [step, setStep] = useState(1);
  const [selectedChatJids, setSelectedChatJids] = useState<Set<string>>(
    new Set(),
  );
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [errors, setErrors] = useState<z.ZodIssue[]>([]);

  const utils = trpc.useUtils();

  const createMutation = trpc.messagingList.createList.useMutation({
    onSuccess: () => {
      toast("Success", { description: "Messaging list created." });
      utils.messagingList.getLists.invalidate();
      onSuccess(); // Call parent callback (closes form, etc.)
      resetForm(); // Reset internal form state
    },
    onError: (error) => {
      toast("Error", {
        description: `Failed to create list: ${error.message}`,
      });
    },
  });

  const updateMutation = trpc.messagingList.updateList.useMutation({
    onSuccess: () => {
      toast("Success", { description: "Messaging list updated." });
      utils.messagingList.getLists.invalidate();
      // Optionally invalidate specific list details if needed elsewhere immediately
      if (listToEdit) {
        utils.messagingList.getListDetails.invalidate({ id: listToEdit.id });
      }
      onSuccess(); // Call parent callback (closes form, etc.)
      resetForm(); // Reset internal form state
    },
    onError: (error) => {
      toast("Error", {
        description: `Failed to update list: ${error.message}`,
      });
    },
  });

  // Effect to populate form when listToEdit changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (listToEdit) {
        setStep(1); // Start at step 1 for editing members
        setListName(listToEdit.name);
        setListDescription(listToEdit.description || "");
        // Populate selected chats from listToEdit.members
        setSelectedChatJids(
          new Set(listToEdit.members.map((m) => m.remoteJid)),
        );
        setErrors([]); // Clear previous errors
      } else {
        // Reset form if opening for creation
        resetForm();
      }
    }
    // Dependency array includes isOpen to reset/populate when dialog opens/closes
    // and listToEdit to populate when edit data is available
  }, [listToEdit, isOpen]);

  const resetForm = () => {
    setStep(1);
    setSelectedChatJids(new Set());
    setListName("");
    setListDescription("");
    setErrors([]);
  };

  const handleChatSelect = (
    chatId: string,
    checked: boolean | "indeterminate",
  ) => {
    setSelectedChatJids((prev) => {
      const next = new Set(prev);
      if (checked === true) {
        next.add(chatId);
      } else {
        next.delete(chatId);
      }
      return next;
    });
  };

  const handleNextStep = () => {
    if (selectedChatJids.size === 0) {
      toast("Error", {
        description: "Please select at least one chat.",
      });
      return;
    }
    setStep(2);
  };

  // Handles both create and update submissions
  const handleSubmit = () => {
    const result = formSchema.safeParse({
      name: listName,
      description: listDescription,
    });

    if (!result.success) {
      setErrors(result.error.issues);
      toast("Error", { description: "Please fix the errors in the form." });
      return;
    }
    setErrors([]);

    // Prepare the members array based on current selection
    const selectedMembers: ListMemberInput[] = availableChats
      .filter((chat) => selectedChatJids.has(chat.id))
      .map((chat) => ({
        remoteJid: chat.id,
        // Ensure name is always a string, fallback to JID if null/undefined
        name: chat.name ?? chat.id,
      }));

    if (listToEdit) {
      // UPDATE existing list
      updateMutation.mutate({
        id: listToEdit.id, // Pass the ID of the list to update
        name: result.data.name,
        description: result.data.description,
        members: selectedMembers, // Pass the full list of selected members
      });
    } else {
      // CREATE new list
      createMutation.mutate({
        name: result.data.name,
        description: result.data.description,
        members: selectedMembers,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Filter available chats to show only groups with names
  const groupChats = availableChats.filter(
    (chat) => chat.id.endsWith("@g.us") && chat.name,
  );

  const stepTitle = listToEdit
    ? ({
        1: "Edit List Members",
        2: "Edit List Name",
      } as const)
    : ({
        1: "Select List Members",
        2: "Name your List",
      } as const);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {/* Adjust title based on edit mode */}
            Step {step} of 2 - {stepTitle[step as 1 | 2]}{" "}
          </DialogTitle>
          {/* ... DialogDescription ... */}
          <DialogDescription>
            {step === 1
              ? "Select the group chats to include in this list."
              : "Give your list a name and optional description."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Members */}
        {step === 1 && (
          <div className="py-4">
            <Label>Available Group Chats</Label>
            <ScrollArea className="h-72 w-full rounded-md border p-2 mt-2">
              {groupChats.length > 0 ? (
                groupChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center space-x-2 mb-2 p-2"
                  >
                    <Checkbox
                      id={chat.id}
                      // Checkbox state reflects selection
                      checked={selectedChatJids.has(chat.id)}
                      onCheckedChange={(checked) =>
                        handleChatSelect(chat.id, checked)
                      }
                      disabled={isLoading} // Disable while submitting
                    />
                    <label
                      htmlFor={chat.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {/* Display chat name, fallback to ID if name is missing */}
                      {chat.name ?? chat.id}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No available group chats found. Ensure you are connected and
                  chats have loaded.
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 2: Name and Description */}
        {step === 2 && (
          <div className="grid gap-4 py-4">
            {/* Name Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="col-span-3"
                disabled={isLoading}
              />
              {/* Display validation error for name */}
              {errors.find((e) => e.path.includes("name")) && (
                <p className="col-span-4 text-red-500 text-sm text-right">
                  {errors.find((e) => e.path.includes("name"))?.message}
                </p>
              )}
            </div>
            {/* Description Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={listDescription}
                onChange={(e) => setListDescription(e.target.value)}
                className="col-span-3"
                placeholder="(Optional)"
                disabled={isLoading}
              />
              {/* Display validation error for description (if any added) */}
              {errors.find((e) => e.path.includes("description")) && (
                <p className="col-span-4 text-red-500 text-sm text-right">
                  {errors.find((e) => e.path.includes("description"))?.message}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {/* Footer buttons change based on step */}
          {step === 1 && (
            <Button onClick={handleNextStep} disabled={isLoading}>
              Next: Name List
            </Button>
          )}
          {step === 2 && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)} // Go back to member selection
                disabled={isLoading}
              >
                Back: Select Members
              </Button>
              {/* Submit button calls handleSubmit */}
              <Button onClick={handleSubmit} disabled={isLoading}>
                {/* Adjust button text based on loading and edit mode */}
                {isLoading
                  ? listToEdit
                    ? "Saving..."
                    : "Creating..."
                  : listToEdit
                    ? "Save Changes" // Text for editing
                    : "Finalize List"}{" "}
                {/* Text for creating */}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
