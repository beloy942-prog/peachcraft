-- Add GCash QR code image URL to website_settings
-- Stores the QR code image displayed to customers during GCash checkout.

ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS gcash_qr_url text;
