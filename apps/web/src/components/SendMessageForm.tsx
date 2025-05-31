import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { ImageUploadInput } from "./ImageUploadInput"; // Import the new component

// Define the shape of a list expected by this form
interface BasicList {
  id: number;
  name: string;
}

interface SendMessageFormProps {
  availableLists: BasicList[];
  onSuccess: (details: { broadcastId: number; recipients: string[] }) => void;
}

// Basic validation: message content is required
const formSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty."),
});

// Define API response types (optional but good practice)
interface SendSuccessResponse {
  success: true;
  message: string;
  broadcastId: number;
  recipients: string[];
}
interface SendErrorResponse {
  success: false;
  message: string;
  broadcastId?: number | null;
  recipients?: string[];
}
type SendApiResponse = SendSuccessResponse | SendErrorResponse;

export function SendMessageForm({
  availableLists,
  onSuccess,
}: SendMessageFormProps) {
  const [selectedListIds, setSelectedListIds] = useState<Set<number>>(
    new Set()
  );
  const [messageContent, setMessageContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null); // State for files from ImageUploadInput
  const [errors, setErrors] = useState<z.ZodIssue[]>([]);

  const sendMessageMutation = useMutation<
    SendApiResponse, // Expected success response type
    Error, // Error type
    { content: string; listIds: number[]; files: FileList | null } // Variables type
  >({
    mutationFn: async ({ content, listIds, files }) => {
      const clientId = localStorage.getItem("clientId");
      // Client ID check remains the same
      if (!clientId) {
        throw new Error("Client ID is required");
      }
      const formData = new FormData();

      formData.append("clientId", clientId);
      formData.append("content", content);
      formData.append("listIds", JSON.stringify(listIds)); // Send listIds as JSON string

      // Append file if it exists (will be at most one)
      if (files && files.length > 0) {
        formData.append("file", files[0]); // Key MUST match multer setup ('file')
      }

      // Ensure API endpoint URL is correct (using HTTP_PORT 3000 from server.ts)
      const response = await fetch("http://localhost:3000/api/broadcast", {
        method: "POST",
        body: formData,
        // No 'Content-Type' header needed, browser sets it for FormData
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Use message from backend response if available
        throw new Error(
          responseData.message || `HTTP error! status: ${response.status}`
        );
      }

      console.log("Broadcast request sent:", responseData);
      return responseData as SendApiResponse; // Type assertion
    },
    onSuccess: (data) => {
      if (data.success) {
        toast("Success", { description: data.message || "Broadcast started." });
        resetForm();
        console.log("Broadcast started successfully:", data);
        onSuccess({
          // Call the onSuccess callback with the data
          broadcastId: data.broadcastId,
          recipients: data.recipients,
        });
      } else {
        // Handle API returning success: false
        toast("Info", {
          description: data.message || "Broadcast could not be started.",
        });
        // Optionally reset form or keep state based on the message
      }
    },
    onError: (error) => {
      toast("Error", {
        description: `Failed to start broadcast: ${error.message}`,
      });
    },
  });

  const resetForm = () => {
    setSelectedListIds(new Set());
    setMessageContent("");
    setSelectedFiles(null); // Reset files state
    setErrors([]);
    // Note: ImageUploadInput handles its internal reset via onFilesChange(null)
  };

  const handleListSelect = (
    listId: number,
    checked: boolean | "indeterminate"
  ) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (checked === true) {
        next.add(listId);
      } else {
        next.delete(listId);
      }
      return next;
    });
  };

  // Callback for the ImageUploadInput component
  const handleFilesUpdate = (files: FileList | null) => {
    setSelectedFiles(files);
  };

  const handleSubmit = () => {
    // Validate message content
    const result = formSchema.safeParse({ content: messageContent });
    if (!result.success) {
      setErrors(result.error.issues);
      toast("Error", { description: "Please enter a message." });
      return;
    }
    setErrors([]);

    // Validate list selection
    if (selectedListIds.size === 0) {
      toast("Error", { description: "Please select at least one list." });
      return;
    }

    // Call the mutation with current state values
    sendMessageMutation.mutate({
      content: result.data.content,
      listIds: Array.from(selectedListIds),
      files: selectedFiles, // Pass the files from state
    });
  };

  const isLoading = sendMessageMutation.isPending;

  return (
    <Card className="w-full mb-6">
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {" "}
        {/* Adjusted grid for responsiveness */}
        {/* Left Column: Message & File Upload */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Image Upload Component */}
          <div className="flex flex-col gap-1.5">
            {/* Updated Label */}
            <Label>Attach Image (Optional)</Label>
            <ImageUploadInput
              onFilesChange={handleFilesUpdate}
              accept="image/*" // Explicitly set accept to images only
              disabled={isLoading}
            />
          </div>
          {/* Message Content Textarea */}
          <div className="flex flex-col gap-1.5 flex-1">
            <Label htmlFor="message-content">Write Your Message</Label>
            <Textarea
              id="message-content"
              placeholder="Type your message here..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={5}
              disabled={isLoading}
              className={cn(
                "flex-1",
                errors.find((e) => e.path.includes("content"))
                  ? "border-red-500"
                  : ""
              )}
            />
            {errors.find((e) => e.path.includes("content")) && (
              <p className="text-red-500 text-sm">
                {errors.find((e) => e.path.includes("content"))?.message}
              </p>
            )}
          </div>
        </div>
        {/* Right Column: List Selection & Send Button */}
        <div className="md:col-span-1 flex flex-col gap-4 justify-between">
          <div className="grid gap-1.5">
            <Label>Select Lists</Label>
            <ScrollArea className="h-64 w-full rounded-md border p-2">
              {availableLists.length > 0 ? (
                availableLists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-center space-x-2 mb-2 p-1"
                  >
                    <Checkbox
                      id={`list-${list.id}`}
                      checked={selectedListIds.has(list.id)}
                      onCheckedChange={(checked) =>
                        handleListSelect(list.id, checked)
                      }
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={`list-${list.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {list.name}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground p-2">
                  No messaging lists found. Create a list first.
                </p>
              )}
            </ScrollArea>
          </div>
          {/* Send Button */}
          <div className="flex flex-col gap-2 mt-auto">
            {" "}
            {/* Pushes button to bottom */}
            <Button
              onClick={handleSubmit}
              disabled={
                isLoading ||
                availableLists.length === 0 ||
                selectedListIds.size === 0 ||
                !messageContent // Content is mandatory
              }
              className="w-full" // Make button full width
            >
              {isLoading ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
