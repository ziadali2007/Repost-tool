import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
// Remove Dialog imports
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, X } from "lucide-react"; // Add X icon
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"; // Import Card components, remove CardFooter if not used

interface Chat {
  id: string; // remoteJid
  name: string | null;
}

interface RecipientStatus {
  jid: string;
  name?: string | null; // Add optional name field
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

interface BroadcastProgressDisplayProps {
  // Remove isOpen and onOpenChange
  broadcastId: number | null;
  initialRecipients: string[];
  onClear: () => void; // Add a callback to clear the display
  availableChats: Chat[]; // Add availableChats prop
}

// Rename component
export function BroadcastProgressDisplay({
  // Remove isOpen and onOpenChange props
  broadcastId,
  initialRecipients,
  onClear,
  availableChats, // Destructure availableChats
}: BroadcastProgressDisplayProps) {
  const [recipientStatuses, setRecipientStatuses] = useState<RecipientStatus[]>(
    []
  );
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<{
    success: number;
    errors: number;
  } | null>(null);

  // Create a map for quick name lookup
  const chatNameMap = useMemo(() => {
    return new Map(availableChats.map((chat) => [chat.id, chat.name]));
  }, [availableChats]);

  trpc.broadcast.onBroadcastComplete.useSubscription(
    { broadcastId: broadcastId! },
    {
      enabled: !!broadcastId, // Subscribe only when broadcastId is not null
      onData: (data) => {
        console.log("Received broadcast complete event:", data, broadcastId);
        if (data.broadcastId !== broadcastId) return; // Ignore events for previous broadcasts
        setIsComplete(true);
        setSummary({
          success: data.successCount,
          errors: data.errorCount,
        });
      },
      onError: (err) => {
        console.error("Subscription error:", err);
        // Optionally show an error message to the user
      },
    }
  );

  // Initialize/Reset statuses when broadcastId changes
  useEffect(() => {
    if (broadcastId && initialRecipients.length > 0) {
      // Only reset if the broadcastId actually changes to a new one or from null
      setRecipientStatuses(
        initialRecipients.map((jid) => ({
          jid,
          name: chatNameMap.get(jid), // Get name from map
          status: "pending",
        }))
      );
      setIsComplete(false);
      setSummary(null);
    } else if (!broadcastId) {
      // Clear state if broadcastId becomes null (e.g., cleared by parent)
      setRecipientStatuses([]);
      setIsComplete(false);
      setSummary(null);
    }
    // Dependency on broadcastId ensures re-initialization for new broadcasts
  }, [broadcastId, chatNameMap]); // Add chatNameMap dependency

  // Effect to update statuses based on initialRecipients if broadcastId is the same
  // This handles cases where recipients might update for the *same* broadcastId, though unlikely with current flow
  useEffect(() => {
    if (broadcastId && initialRecipients.length > 0) {
      setRecipientStatuses((prevStatuses) => {
        // Create a map of existing statuses
        const statusMap = new Map(prevStatuses.map((s) => [s.jid, s]));
        // Create new status list, preserving existing statuses if jid matches
        return initialRecipients.map((jid) => {
          const existingStatus = statusMap.get(jid);
          return (
            existingStatus || {
              jid,
              name: chatNameMap.get(jid), // Get name from map
              status: "pending",
            }
          );
        });
      });
    }
  }, [initialRecipients, broadcastId, chatNameMap]); // Add chatNameMap dependency

  // Subscribe to progress updates
  trpc.broadcast.onBroadcastProgress.useSubscription(
    { broadcastId: broadcastId! },
    {
      enabled: !!broadcastId, // Subscribe only when broadcastId is not null
      onData: (data) => {
        console.log("Received broadcast event:", data, broadcastId);
        if (data.broadcastId !== broadcastId) return; // Ignore events for previous broadcasts

        setRecipientStatuses((prevStatuses) =>
          prevStatuses.map((rs) =>
            rs.jid === data.jid
              ? { ...rs, status: data.status, error: data.error }
              : rs
          )
        );
      },
      onError: (err) => {
        console.error("Subscription error:", err);
        // Optionally show an error message to the user
      },
    }
  );

  const progressValue = useMemo(() => {
    if (recipientStatuses.length === 0) return 0;
    const completedCount = recipientStatuses.filter(
      (rs) => rs.status === "sent" || rs.status === "error"
    ).length;
    return (completedCount / recipientStatuses.length) * 100;
  }, [recipientStatuses]);

  const getStatusBadge = (status: RecipientStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "sending":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Sending
          </Badge>
        );
      case "sent":
        return (
          <Badge>
            <CheckCircle className="mr-1 h-3 w-3" />
            Sent
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  // Conditionally render the whole component based on broadcastId
  // if (!broadcastId) {
  //   return null; // Don't render anything if there's no active broadcast
  // }

  // Return Card instead of Dialog
  return (
    <Card className="w-full mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Sending Progress</CardTitle>
            <CardDescription>Tracking message delivery status.</CardDescription>
          </div>
          {/* Add a clear button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            title="Clear Progress"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressValue} className="w-full" />
        {/* Display dynamic progress count or final summary */}
        <div className="text-sm text-center text-muted-foreground">
          {isComplete && summary
            ? `Completed: ${summary.success} sent, ${summary.errors} errors.`
            : recipientStatuses.length > 0
              ? `Processing... ${
                  recipientStatuses.filter(
                    (s) => s.status === "sent" || s.status === "error"
                  ).length
                } / ${recipientStatuses.length}`
              : null}
        </div>

        <ScrollArea className="h-60 w-full rounded-md border p-2">
          {
            recipientStatuses.length > 0
              ? recipientStatuses.map((rs) => (
                  <div
                    key={rs.jid}
                    className="flex items-center justify-between space-x-2 mb-1 p-2 text-sm"
                  >
                    {/* Display name, fallback to JID */}
                    <span className="truncate" title={rs.jid}>
                      {rs.name ?? rs.jid}
                    </span>
                    <div className="flex-shrink-0">
                      {getStatusBadge(rs.status)}
                    </div>
                  </div>
                ))
              : null
            // <p className="text-sm text-muted-foreground p-2 text-center">
            //   Waiting for recipients...
            // </p>
          }
        </ScrollArea>
        {recipientStatuses.some((rs) => rs.status === "error") && (
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show Errors (
              {recipientStatuses.filter((rs) => rs.status === "error").length})
            </summary>
            <ScrollArea className="h-24 mt-1 bg-secondary/30 p-2 rounded border">
              <ul className="list-disc list-inside space-y-1">
                {recipientStatuses
                  .filter((rs) => rs.status === "error")
                  .map((rs) => (
                    <li key={rs.jid} className="text-destructive">
                      {/* Display name, fallback to JID in error list */}
                      <span className="font-mono text-xs">
                        {rs.name ?? rs.jid}
                      </span>
                      : {rs.error || "Unknown error"}
                    </li>
                  ))}
              </ul>
            </ScrollArea>
          </details>
        )}
      </CardContent>
      {/* Footer removed as clear button is in header */}
    </Card>
  );
}
