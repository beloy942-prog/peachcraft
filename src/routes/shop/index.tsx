import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { getAllProducts } from "@/lib/api/supabase.functions";
import { getSupabaseClient } from "@/lib/supabase";
import { useProductFilters } from "@/hooks/useProductFilters";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ProductAvailabilityFilter, ProductSortOption } from "@/hooks/useProductFilters";
import type { Product } from "@/lib/supabase";

export const Route = createFileRoute("/shop/")(({
  head: () => ({
    meta: [
      { title: "Shop — Peach Craft" },
      { name: "description", content: "Browse handmade fake cakes, kawaii storage boxes and air-dry clay figures from Peach Craft." },
      { property: "og:title", content: "Shop — Peach Craft" },
      { property: "og:description", content: "Browse handmade fake cakes, kawaii storage boxes and clay figures." },
    ],
  }),
  component: ShopPage,
} as any));

const allProductsQuery = {
  queryKey: ["all-products"],
  queryFn: getAllProducts,
};

function ProductCardWrapper({ product, index }: { product: Product; index: number }) {
  const { ref, isVisible } = useRevealOnScroll();

  return (
    <div
      ref={ref}
      className={isVisible ? "animate-stagger-fade" : "opacity-0"}
      style={isVisible ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <ProductCard product={product} />
    </div>
  );
}

const AVAILABILITY_OPTIONS: { value: ProductAvailabilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
];

const SORT_OPTIONS: { value: ProductSortOption; label: string }[] = [
  { value: "newest-first", label: "Featured" },
  { value: "newest-first", label: "Most relevant" },
  { value: "newest-first", label: "Best selling" },
  { value: "name-asc", label: "Alphabetically, A–Z" },
  { value: "name-desc", label: "Alphabetically, Z–A" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "date-old-to-new", label: "Date, old to new" },
  { value: "newest-first", label: "Date, new to old" },
];

function ShopPage() {
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const navigate = useNavigate();
  const { data: all, isLoading, error } = useQuery(allProductsQuery);

  const { filteredProducts, productCount, setAvailabilityFilter, setSortOption, availabilityFilter, sortOption } =
    useProductFilters(all ?? []);
  const [selectedSortLabel, setSelectedSortLabel] = useState("Featured");
  const products = all ?? [];
  const inStockCount = products.filter((p) => (p.stock_qty ?? 0) > 0).length;
  const outOfStockCount = products.filter((p) => (p.stock_qty ?? 0) <= 0).length;

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL ?? "";

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const userEmail = data.user?.email?.toLowerCase() ?? "";
      if (adminEmail && userEmail === adminEmail.toLowerCase()) {
        setIsAdminPreview(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="bg-white py-10 sm:py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        

        {isAdminPreview ? (
          <div className="mt-4 sm:mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => navigate({ to: "/admin" })}
              className="inline-flex items-center justify-center rounded-full bg-[var(--sage)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--foreground)] shadow-soft transition-all btn-bounce-hover"
            >
              Back to admin dashboard
            </button>
          </div>
        ) : null}

        {/* ── Filter / Sort bar ── */}
        {!isLoading && (
          <div className="mt-3 mb-1">
            {/* Row 1 (mobile): Filter left, product count right */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shop-controls-trigger shop-controls-trigger--text"
                  >
                    <span className="text-foreground/60">Filter:</span>
                    <span className="text-primary font-medium">Availability</span>
                    {availabilityFilter !== "all" && (
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold">1</span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="w-64 p-0"
                >
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                    <span className="text-xs text-foreground/50">
                      {availabilityFilter !== "all" ? "1 selected" : "0 selected"}
                    </span>
                    {availabilityFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setAvailabilityFilter("all")}
                        className="text-xs underline text-foreground/60 hover:text-foreground"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="border-t" />
                  <div className="p-2 space-y-1">
                    {AVAILABILITY_OPTIONS.filter((o) => o.value !== "all").map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm"
                      >
                        <Checkbox
                          checked={availabilityFilter === opt.value}
                          onCheckedChange={() => {
                            if (availabilityFilter === opt.value) {
                              setAvailabilityFilter("all");
                            } else {
                              setAvailabilityFilter(opt.value);
                            }
                          }}
                        />
                        <span className="flex-1">{opt.label}</span>
                        <span className="text-xs text-foreground/50 tabular-nums">
                          {opt.value === "in-stock" ? inStockCount : outOfStockCount}
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Product count — always visible on the right */}
              <span className="text-xs text-neutral-400 tabular-nums">
                {productCount} {productCount === 1 ? "product" : "products"}
              </span>
            </div>

            {/* Row 2 (mobile): Sort — full width feel, right-aligned */}
            <div className="flex items-center justify-end pt-2.5 pb-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shop-controls-trigger shop-controls-trigger--select"
                  >
                    <span className="text-foreground/60">Sort:</span>
                    <span className="font-medium text-foreground">
                      {selectedSortLabel}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={4}
                  className="w-56 p-0"
                >
                  <div className="py-1">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setSortOption(opt.value);
                          setSelectedSortLabel(opt.label);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm transition-colors",
                          selectedSortLabel === opt.label
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-foreground hover:bg-accent"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* ── Product grid ── */}
        <ul id="product-grid" className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-2 list-none p-0">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <li key={index} className="flex flex-col bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-square bg-neutral-100" />
                <div className="p-3 sm:p-4 flex flex-col gap-2">
                  <div className="h-3 w-3/4 rounded-full bg-neutral-100" />
                  <div className="h-3 w-1/3 rounded-full bg-neutral-100" />
                </div>
              </li>
            ))
          ) : error ? (
            <li className="col-span-full"><div className="rounded-2xl bg-white border border-neutral-100 p-6 text-sm text-red-400 shadow-sm">
              {error instanceof Error ? error.message : "Unable to load products."}
            </div></li>
          ) : filteredProducts.length === 0 ? (
            <li className="col-span-full"><p className="text-center text-neutral-400 py-16 text-sm">
              No products match the selected filters.
            </p></li>
          ) : filteredProducts.map((p, i) => (
            <li key={p.id}>
              <ProductCardWrapper
                product={p}
                index={i}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* ── Shop page scoped styles ── */}
      <style>{`
        /* ── Controls bar ── */
        .shop-controls-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          padding-bottom: 14px;
          border-bottom: 1px solid oklch(0.92 0.02 80);
        }

        /* ── Control triggers ── */
        .shop-controls-trigger {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .shop-controls-trigger--text {
          background: none;
          border: none;
          padding: 0;
          color: inherit;
        }
        .shop-controls-trigger--select {
          background: none;
          border: 1.5px solid oklch(0.87 0.03 150);
          border-radius: 8px;
          padding: 7px 11px;
          gap: 6px;
          transition: border-color 200ms;
        }
        .shop-controls-trigger--select:hover {
          border-color: oklch(0.6 0.06 150);
        }

      `}</style>
    </section>
  );
}
