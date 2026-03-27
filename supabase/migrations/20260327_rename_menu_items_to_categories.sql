-- Migration: Rename menu_items → categories
-- Run this in the Supabase SQL editor

-- 1. Rename tables
ALTER TABLE menu_items RENAME TO categories;
ALTER TABLE workshop_menu_items RENAME TO workshop_categories;

-- 2. Rename columns referencing menu_items
ALTER TABLE plates RENAME COLUMN menu_item_id TO category_id;
ALTER TABLE completions RENAME COLUMN menu_item_id TO category_id;
ALTER TABLE training_task_completions RENAME COLUMN menu_item_id TO category_id;
ALTER TABLE subcategories RENAME COLUMN menu_item_id TO category_id;
ALTER TABLE workshop_categories RENAME COLUMN menu_item_id TO category_id;
