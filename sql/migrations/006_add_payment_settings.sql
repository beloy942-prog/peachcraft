-- Add GCash payment configuration columns to website_settings
-- These store the GCash number and account name displayed to customers during checkout.

ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS gcash_number text,
  ADD COLUMN IF NOT EXISTS gcash_account_name text;
