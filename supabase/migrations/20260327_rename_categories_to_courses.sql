-- Migration: Rename categories → courses
-- Run this in the Supabase SQL editor

-- 1. Rename tables
ALTER TABLE categories RENAME TO courses;
ALTER TABLE visible_categories RENAME TO visible_courses;

-- 2. Rename columns
ALTER TABLE menu_items RENAME COLUMN category_id TO course_id;
ALTER TABLE visible_courses RENAME COLUMN category_id TO course_id;
