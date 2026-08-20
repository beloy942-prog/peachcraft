-- Add human-readable order_number column to orders.
-- Format: PTT-YYYYMMDD-XXX (date prefix + first 3 chars of UUID, uppercase).
-- This is the single source of truth displayed at checkout and in admin views.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number text;

-- Unique index so the column can be used as a lookup / search key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);

COMMENT ON COLUMN orders.order_number IS
  'Human-readable order identifier (PTT-YYYYMMDD-XXX). Generated server-side at order creation. Used for GCash note matching.';

-- Backfill existing orders using a one-shot PL/pgSQL block.
-- Uses created_at for the date prefix and the first 3 hex chars of the UUID for the suffix.
-- Handles date-boundary collisions by appending -A, -B, ... if a duplicate is encountered.
DO $$
DECLARE
  rec RECORD;
  ymd text;
  suffix text;
  base text;
  candidate text;
  seq int;
BEGIN
  FOR rec IN
    SELECT id, created_at
    FROM orders
    WHERE order_number IS NULL
    ORDER BY created_at ASC
  LOOP
    ymd := to_char(rec.created_at AT TIME ZONE 'UTC', 'YYYYMMDD');
    suffix := upper(replace(substring(replace(rec.id::text, '-', ''), 1, 3), '-', ''));
    base := 'PTT-' || ymd || '-' || suffix;
    candidate := base;
    seq := 0;

    -- If a collision somehow exists, append -A, -B, etc.
    WHILE EXISTS (SELECT 1 FROM orders WHERE order_number = candidate AND id != rec.id) LOOP
      seq := seq + 1;
      candidate := base || '-' || chr(64 + seq); -- 65 = 'A'
    END LOOP;

    UPDATE orders SET order_number = candidate WHERE id = rec.id;
  END LOOP;
END $$;
