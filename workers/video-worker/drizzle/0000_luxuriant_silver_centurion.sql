CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`user_id` text,
	`agora_uid` integer NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `stream`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recording` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`agora_resource_id` text,
	`agora_sid` text,
	`status` text NOT NULL,
	`r2_key` text,
	`file_size` integer,
	`duration` integer,
	`started_at` integer,
	`stopped_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `stream`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stream` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`host_user_id` text NOT NULL,
	`agora_channel_name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stream_slug_unique` ON `stream` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `stream_agora_channel_name_unique` ON `stream` (`agora_channel_name`);--> statement-breakpoint
CREATE TABLE `transcript` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`language` text NOT NULL,
	`format` text NOT NULL,
	`r2_key` text,
	`is_translation` integer DEFAULT false NOT NULL,
	`source_transcript_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `stream`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_transcript_id`) REFERENCES `transcript`(`id`) ON UPDATE no action ON DELETE no action
);
