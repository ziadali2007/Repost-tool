DROP INDEX `chats_client_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `chats_id_unique` ON `chats` (`id`);--> statement-breakpoint
DROP INDEX `messages_client_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_unique` ON `messages` (`id`);