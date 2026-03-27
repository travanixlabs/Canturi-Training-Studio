-- Migration: Rename Module -> Subcategory, Session -> Training Task
-- Run this in the Supabase SQL editor

-- 1. Rename tables
ALTER TABLE modules RENAME TO subcategories;
ALTER TABLE module_completions RENAME TO subcategory_completions;
ALTER TABLE recurring_task_completions RENAME TO training_task_completions;

-- 2. Rename columns
ALTER TABLE subcategory_completions RENAME COLUMN module_id TO subcategory_id;
ALTER TABLE menu_items RENAME COLUMN recurring_task_content TO training_task_content;

-- 3. Rename indexes (if they exist)
ALTER INDEX IF EXISTS modules_pkey RENAME TO subcategories_pkey;
ALTER INDEX IF EXISTS module_completions_pkey RENAME TO subcategory_completions_pkey;
ALTER INDEX IF EXISTS recurring_task_completions_pkey RENAME TO training_task_completions_pkey;

-- 4. Rename storage path prefix (optional — existing files keep working, new uploads use new prefix)
-- Note: The Supabase storage bucket 'module-files' is NOT renamed here.
-- Renaming a bucket requires creating a new one and migrating files.
-- The bucket name is an implementation detail and doesn't affect users.
