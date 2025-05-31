CREATE TABLE `auth_keys` (
	`client_id` text NOT NULL,
	`key_type` text NOT NULL,
	`key_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_keys_client_id_key_type_key_id_unique` ON `auth_keys` (`client_id`,`key_type`,`key_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_auth_creds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_auth_creds`("id", "client_id", "data") SELECT "id", "client_id", "data" FROM `auth_creds`;--> statement-breakpoint
DROP TABLE `auth_creds`;--> statement-breakpoint
ALTER TABLE `__new_auth_creds` RENAME TO `auth_creds`;--> statement-breakpoint
PRAGMA foreign_keys=ON;