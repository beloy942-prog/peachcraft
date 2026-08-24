-- Fix the order_items FK: the live constraint (order_items_order_id_fkey) was
-- created WITHOUT ON DELETE CASCADE, so deleting an orders row fails with an
-- FK violation while line items exist. With CASCADE in place, deleting the
-- orders row removes its order_items + gcash_payments (already CASCADE via
-- migration 004) atomically in one statement.
--
-- Note: brief ACCESS EXCLUSIVE lock on order_items during re-constraint; fine
-- at current scale. Idempotent via IF EXISTS.

alter table order_items
  drop constraint if exists order_items_order_id_fkey;

alter table order_items
  add constraint order_items_order_id_fkey
  foreign key (order_id)
  references public.orders(id)
  on delete cascade;

comment on constraint order_items_order_id_fkey on order_items is 'Cascade delete with parent order so admin hard-delete cannot orphan or be blocked by line items.';
