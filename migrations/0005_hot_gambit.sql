CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`reference_number` text NOT NULL,
	`image` text,
	`owner_number` text NOT NULL,
	`owner_push_name` text NOT NULL,
	`original_message_id` text NOT NULL,
	FOREIGN KEY (`original_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `is_analyzed` integer DEFAULT false;