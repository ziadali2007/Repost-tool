PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_broadcast_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`broadcast_id` integer NOT NULL,
	`list_id` integer NOT NULL,
	FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `messaging_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_broadcast_lists`("id", "broadcast_id", "list_id") SELECT "id", "broadcast_id", "list_id" FROM `broadcast_lists`;--> statement-breakpoint
DROP TABLE `broadcast_lists`;--> statement-breakpoint
ALTER TABLE `__new_broadcast_lists` RENAME TO `broadcast_lists`;--> statement-breakpoint
PRAGMA foreign_keys=ON;