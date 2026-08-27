CREATE TABLE `fragrantica_reference` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fragrantica_url` text NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`gender` text DEFAULT 'unisexe' NOT NULL,
	`notes_top` text,
	`notes_heart` text,
	`notes_base` text,
	CONSTRAINT "fragrantica_reference_gender_check" CHECK("fragrantica_reference"."gender" IN ('homme', 'femme', 'unisexe'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fragrantica_reference_fragrantica_url_unique` ON `fragrantica_reference` (`fragrantica_url`);