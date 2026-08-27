CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`gender_preference` text DEFAULT 'unisexe' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_preferences_gender_check" CHECK("user_preferences"."gender_preference" IN ('homme', 'femme', 'unisexe'))
);
