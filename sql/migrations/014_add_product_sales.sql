-- Add product sales tracking table
create table if not exists product_sales (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references products(id) on delete cascade,
  qty_sold integer default 1 not null,
  sold_at timestamptz default now()
);
create index if not exists idx_product_sales_product_id on product_sales(product_id);

comment on table product_sales is 'Per-order-item sales tracking. One row per qty sold, aggregated for total sold count.';
comment on column product_sales.qty_sold is 'Number of units sold in this order item (typically 1 per line item, but can be >1 for multi-quantity orders)';
comment on column product_sales.sold_at is 'When the sale occurred (order creation time)';