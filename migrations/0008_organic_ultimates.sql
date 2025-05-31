PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messaging_list_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`remote_jid` text NOT NULL,
	`list_id` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `messaging_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_messaging_list_members`("id", "client_id", "name", "remote_jid", "list_id") SELECT "id", "client_id", "name", "remote_jid", "list_id" FROM `messaging_list_members`;--> statement-breakpoint
DROP TABLE `messaging_list_members`;--> statement-breakpoint
ALTER TABLE `__new_messaging_list_members` RENAME TO `messaging_list_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `messaging_list_members_list_id_remote_jid_unique` ON `messaging_list_members` (`list_id`,`remote_jid`);--> statement-breakpoint
ALTER TABLE `messaging_lists` ADD `client_id` text NOT NULL;