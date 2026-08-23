-- Add admin-editable product detail fields to products.
-- All four are nullable text so existing products keep working (NULL = section
-- hidden on the storefront, field omitted in forms until filled).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS materials text,
  ADD COLUMN IF NOT EXISTS dimensions text,
  ADD COLUMN IF NOT EXISTS care_instructions text,
  ADD COLUMN IF NOT EXISTS return_policy text;

COMMENT ON COLUMN products.materials IS 'Optional. Materials used; rendered on the product detail page only when non-empty.';
COMMENT ON COLUMN products.dimensions IS 'Optional. Product dimensions; rendered on the product detail page only when non-empty.';
COMMENT ON COLUMN products.care_instructions IS 'Optional. Care instructions; rendered on the product detail page only when non-empty.';
COMMENT ON COLUMN products.return_policy IS 'Optional. Per-product return policy override; rendered on the product detail page only when non-empty.';
