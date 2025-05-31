PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`reference_number` text NOT NULL,
	`image` text,
	`owner_number` text NOT NULL,
	`owner_push_name` text NOT NULL,
	`original_message_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_listings`("id", "title", "reference_number", "image", "owner_number", "owner_push_name", "original_message_id") SELECT "id", "title", "reference_number", "image", "owner_number", "owner_push_name", "original_message_id" FROM `listings`;--> statement-breakpoint
DROP TABLE `listings`;--> statement-breakpoint
ALTER TABLE `__new_listings` RENAME TO `listings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`client_id` text NOT NULL,
	`remote_jid` text,
	`from_me` integer,
	`id` text PRIMARY KEY NOT NULL,
	`participant` text,
	`message` text,
	`message_timestamp` integer,
	`status` integer,
	`push_name` text,
	`broadcast` integer,
	`starred` integer,
	`message_stub_type` integer,
	`message_stub_parameters` text,
	`labels` text,
	`user_receipt` text,
	`reactions` text,
	`media_data` text,
	`poll_updates` text,
	`keep_in_chat` integer,
	`message_secret` text,
	`pin_in_chat` text,
	`chat_id` text,
	`is_analyzed` integer DEFAULT false
);
--> statement-breakpoint
INSERT INTO `__new_messages`("client_id", "remote_jid", "from_me", "id", "participant", "message", "message_timestamp", "status", "push_name", "broadcast", "starred", "message_stub_type", "message_stub_parameters", "labels", "user_receipt", "reactions", "media_data", "poll_updates", "keep_in_chat", "message_secret", "pin_in_chat", "chat_id", "is_analyzed") SELECT "client_id", "remote_jid", "from_me", "id", "participant", "message", "message_timestamp", "status", "push_name", "broadcast", "starred", "message_stub_type", "message_stub_parameters", "labels", "user_receipt", "reactions", "media_data", "poll_updates", "keep_in_chat", "message_secret", "pin_in_chat", "chat_id", "is_analyzed" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_unique` ON `messages` (`id`);