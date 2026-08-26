export const PRODUCT_CATEGORY_OPTIONS = ["Airdry Clay Crafts", "Fake Cakes"] as const;

export const LEGACY_PRODUCT_CATEGORY_OPTIONS = ["Rings", "Bracelets", "Earrings", "Accessories"] as const;

export function normalizeProductCategories(categoryValue?: string | null): string[] {
  if (!categoryValue) return [];

  return categoryValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAvailableProductCategories(selectedCategories: string[] = []): string[] {
  return PRODUCT_CATEGORY_OPTIONS.filter((category) => !selectedCategories.includes(category));
}
