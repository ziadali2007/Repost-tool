import { format } from "date-fns";

// Define the expected structure of the message data prop
interface MessageData {
  id: string;
  fromMe: boolean;
  remoteJid: string;
  participant?: string | null;
  pushName?: string | null;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: {
      caption: string;
      url: string /* Add other image props if needed */;
      jpegThumbnail?: string;
      mimetype?: string;
    };
    protocolMessage?: { type: string };
  } | null;
  messageTimestamp?: number | null;
  messageStubType?: number | null;
  messageStubParameters?: string[] | null;
  // Add any other relevant fields from your data structure
}

interface ChatBubbleProps {
  messageData: MessageData;
}

// Helper function to determine message content (moved from Main.tsx)
const getMessageContent = (messageData: MessageData) => {
  if (messageData.message?.conversation) {
    return <p>{messageData.message.conversation}</p>;
  }
  if (messageData.message?.extendedTextMessage?.text) {
    return <p>{messageData.message.extendedTextMessage.text}</p>;
  }
  if (messageData.message?.imageMessage) {
    return (
      <div>
        <img
          src={`data:${messageData.message.imageMessage.mimetype};base64,${messageData.message.imageMessage.jpegThumbnail}`}
          alt="Image"
          className="w-24 h-24 object-cover"
        />

        <p>{messageData.message.imageMessage.caption}</p>
      </div>
    );
  }
  if (messageData.message?.protocolMessage) {
    // Apply text color based on context (fromMe)
    const textColor = messageData.fromMe ? "text-blue-200" : "text-gray-500";
    return (
      <p className={`text-xs italic ${textColor}`}>
        [Protocol Message: {messageData.message.protocolMessage.type}]
      </p>
    );
  }
  if (messageData.messageStubType) {
    const params = messageData.messageStubParameters?.join(", ") || "";
    // Apply text color based on context (fromMe)
    const textColor = messageData.fromMe ? "text-blue-200" : "text-gray-500";
    return (
      <p className={`text-xs italic ${textColor}`}>
        [System Message: Type {messageData.messageStubType}
        {params && ` (${params})`}]
      </p>
    );
  }
  // Fallback for unhandled message types
  return (
    <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded text-black">
      {JSON.stringify(messageData.message || messageData, null, 2)}
    </pre>
  );
};

export const ChatBubble = ({ messageData }: ChatBubbleProps) => {
  const { id, fromMe, remoteJid, participant, pushName, messageTimestamp } =
    messageData;

  const isGroup = remoteJid.endsWith("@g.us");
  const senderName = pushName || participant?.split("@")[0]; // Use pushName or derive from participant JID
  const timestamp = messageTimestamp
    ? format(new Date(messageTimestamp * 1000), "Pp") // Format timestamp
    : "No timestamp";

  return (
    <div
      key={id}
      className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-xs lg:max-w-md p-3 rounded-lg shadow whitespace-pre-wrap  ${
          fromMe
            ? "bg-blue-500 text-white text-right"
            : "bg-white text-black text-left"
        }`}
      >
        {isGroup && !fromMe && senderName && (
          <p className="text-xs font-semibold mb-1 text-purple-600">
            {senderName}
          </p> // Show sender name for group messages
        )}
        {getMessageContent(messageData)}
        <p
          className={`text-xs mt-1 ${
            fromMe ? "text-blue-200" : "text-gray-500"
          } text-right`}
        >
          {timestamp}
        </p>
      </div>
    </div>
  );
};
