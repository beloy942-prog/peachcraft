-- Replace facebook_url with tiktok_url and remove twitter_url from the
-- website_settings singleton row. Idempotent via IF EXISTS / IF NOT EXISTS.

-- Rename facebook_url → tiktok_url (preserves existing data)
alter table website_settings
  rename column facebook_url to tiktok_url;

-- Drop twitter_url (no longer displayed anywhere)
alter table website_settings
  drop column if exists twitter_url;
