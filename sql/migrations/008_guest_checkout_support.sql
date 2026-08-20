-- Guest checkout: orders.user_id is already nullable (no NOT NULL constraint),
-- but this migration documents the intent and adds supporting infrastructure.

-- Ensure orders.user_id foreign key allows NULL for guest orders.
-- PostgreSQL FK columns accept NULL by default, so this is a safety net.
-- If a NOT NULL constraint exists (unlikely given the schema), drop it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'n'
      AND conname LIKE '%user_id%'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_not_null;
  END IF;
END $$;

-- Add a NOT NULL check constraint only if it doesn't exist (safety net).
-- This is intentionally NOT adding NOT NULL — guest orders need NULL user_id.
COMMENT ON COLUMN orders.user_id IS 'Nullable for guest orders. NULL = guest checkout, non-NULL = authenticated user.';

-- Index for guest order lookup by shipping_address->>'email' (used by getGuestOrder).
-- Partial index: only for guest orders (user_id IS NULL) to avoid index bloat.
CREATE INDEX IF NOT EXISTS idx_orders_guest_email
  ON orders ((shipping_address ->> 'email'))
  WHERE user_id IS NULL;

-- Record the schema change intent.
COMMENT ON TABLE orders IS 'Supports both authenticated and guest orders. Guest orders have user_id = NULL and are identified by shipping_address->>email.';
