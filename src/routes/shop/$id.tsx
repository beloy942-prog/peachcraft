import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  ShoppingBag,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  Package,
  Ruler,
  Clipboard,
  RotateCcw,
  Upload,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useCartToast } from "@/components/CartToast";
import { getProductById, getAllProducts } from "@/lib/api/supabase.functions";
import { ProductCard } from "@/components/ProductCard";
import { useCurrency } from "@/lib/currency-context";

export const Route = createFileRoute("/shop/$id")({
  head: () => ({
    meta: [
      { title: "Product — Peach Craft" },
      {
        name: "description",
        content:
          "View product details, pricing, and availability from Peach Craft.",
      },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProductById({ data: { id } }),
  });

  const { data: allProducts } = useQuery({
    queryKey: ["all-products"],
    queryFn: getAllProducts,
  });

  const { formatPrice } = useCurrency();
  const [liked, setLiked] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>("materials");
  const { items, addItem } = useCart();
  const { notify } = useCartToast();

  const relatedProducts = (allProducts ?? [])
    .filter((p) => p.id !== product?.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    if (!product) return;
    try {
      addItem(product, quantity);
      notify({
        productName: product.name,
        productImage: product.images?.[0] ?? null,
        qty: quantity,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
    } catch (err) {
      if (err instanceof Error) {
        window.alert(err.message);
      }
    }
  };

  const images = product?.images ?? [];
  const selectedImage = images[selectedImageIndex] ?? images[0] ?? null;
  const existingCartItem = items.find(
    (item) => item.product_id === product?.id,
  );
  // Derive soldOut from DB fields (is_active=false OR stock_qty<=0)
  const isSoldOut =
    product?.is_active === false ||
    (product?.stock_qty != null && product.stock_qty <= 0);
  const isOutOfStock =
    isSoldOut ||
    (product?.stock_qty != null &&
      existingCartItem &&
      existingCartItem.qty >= product.stock_qty);

  const maxQty = product?.stock_qty ?? 25;
  const canIncrement = quantity < maxQty;
  const canDecrement = quantity > 1;

  const toggleAccordion = (key: string) => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  };

  const accordions = [
    {
      key: "materials",
      icon: <HelpCircle className="w-5 h-5 text-foreground/60 shrink-0" />,
      title: "Materials",
      content: product?.materials,
    },
    {
      key: "dimensions",
      icon: <Ruler className="w-5 h-5 text-foreground/60 shrink-0" />,
      title: "Dimensions",
      content: product?.dimensions,
    },
    {
      key: "care",
      icon: <Clipboard className="w-5 h-5 text-foreground/60 shrink-0" />,
      title: "Care Instructions",
      content: product?.care_instructions,
    },
    {
      key: "returns",
      icon: <RotateCcw className="w-5 h-5 text-foreground/60 shrink-0" />,
      title: "Return Policy",
      content: product?.return_policy,
    },
  ].filter(
    (section): section is typeof section & { content: string } =>
      typeof section.content === "string" && section.content.trim().length > 0,
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-foreground/60 text-sm">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-sm">
            {error instanceof Error ? error.message : "Product not found"}
          </p>
          <button
            onClick={() => navigate({ to: "/shop" })}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-foreground/90"
          >
            <ChevronLeft className="w-4 h-4" /> Back to shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Breadcrumb / back bar ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <button
          onClick={() => navigate({ to: "/shop" })}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/50 hover:text-primary transition-colors btn-bounce-hover"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to shop</span>
        </button>
      </div>

      {/* ── Main product section ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-20 items-start">

          {/* ═══════════ LEFT: Image Gallery ═══════════ */}
          <div className="space-y-4">
            {/* Hero image — full-width on mobile, rounded on desktop */}
            <div className="relative w-full overflow-hidden bg-cream
              aspect-[4/3] sm:aspect-square
              rounded-none sm:rounded-[2.5rem]
              border-0 sm:border sm:border-border/80">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-cream">
                  <Package className="w-16 h-16 text-foreground/20" />
                </div>
              )}

              {/* Wishlist button */}
              <button
                type="button"
                onClick={() => setLiked((v) => !v)}
                aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
                className="absolute right-4 top-4 sm:right-6 sm:top-6 grid place-items-center w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-card hover:scale-110 active:scale-95 transition-all"
              >
                <Heart
                  className={cn(
                    "w-5 h-5 transition-colors",
                    liked ? "fill-blush text-blush" : "text-foreground",
                  )}
                />
              </button>

              {/* Sold out badge */}
              {isSoldOut && (
                <div className="absolute left-4 bottom-4 sm:left-6 sm:bottom-6">
                  <span className="px-4 py-2 rounded-xl bg-foreground text-background text-[10px] font-bold uppercase tracking-wider shadow-card select-none">
                    Sold out
                  </span>
                </div>
              )}
            </div>

            {/* Image counter slider — shown when multiple images */}
            {images.length > 1 && (
              <div className="flex items-center justify-center gap-6 text-sm font-semibold text-foreground/75 select-none px-4 sm:px-0">
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                  aria-label="Previous image"
                  className="p-2 hover:text-primary transition-colors btn-bounce-hover"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="tabular-nums font-bold text-sm">
                  {selectedImageIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                  aria-label="Next image"
                  className="p-2 hover:text-primary transition-colors btn-bounce-hover"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Thumbnail grid — desktop only */}
            {images.length > 1 && (
              <div className="hidden lg:grid grid-cols-4 gap-4">
                {(images as string[]).map((src: string, index: number) => (
                  <button
                    key={src}
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-2xl transition-all duration-300 btn-bounce-hover",
                      index === selectedImageIndex
                        ? "ring-2 ring-foreground ring-offset-2 opacity-100"
                        : "ring-1 ring-border hover:ring-foreground/45 opacity-60 hover:opacity-100",
                    )}
                  >
                    <img
                      src={src}
                      alt={`${product.name} view ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══════════ RIGHT: Product Details ═══════════ */}
          <div className="px-4 sm:px-0 lg:sticky lg:top-24 space-y-5 flex flex-col mt-5 lg:mt-0">
            {/* Product name & tag */}
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-brown font-bold leading-tight">
                {product.name}
              </h1>
              {product.tag && (
                <span className="inline-flex px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider">
                  {product.tag}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xl sm:text-2xl font-bold tracking-tight text-foreground",
                  isSoldOut && "text-foreground/40 line-through",
                )}
              >
                {formatPrice(product.price)}
              </p>
              {isSoldOut && (
                <span className="inline-block rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-3 py-1 uppercase tracking-wide">
                  Sold out
                </span>
              )}
              <p className="text-xs text-foreground/50">
                Tax included.{" "}
                <button
                  onClick={() => navigate({ to: "/shipping-policy" })}
                  className="underline underline-offset-2 hover:text-foreground transition-colors font-semibold"
                >
                  Shipping
                </button>{" "}
                calculated at checkout.
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2 text-left">
              <span className="text-sm font-medium text-foreground/75">Quantity</span>
              <div className="flex items-center gap-0 border border-border/80 rounded-lg bg-white w-36 overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => canDecrement && setQuantity((q) => q - 1)}
                  disabled={!canDecrement}
                  aria-label="Decrease quantity"
                  className="grid place-items-center w-11 h-11 text-foreground/60 hover:text-foreground hover:bg-accent/40 disabled:opacity-30 transition-all"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="flex-1 text-center text-sm font-bold text-foreground select-none tabular-nums border-x border-border/60 h-11 flex items-center justify-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => canIncrement && setQuantity((q) => q + 1)}
                  disabled={!canIncrement}
                  aria-label="Increase quantity"
                  className="grid place-items-center w-11 h-11 text-foreground/60 hover:text-foreground hover:bg-accent/40 disabled:opacity-30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {product.stock_qty != null && product.stock_qty > 0 && product.stock_qty <= 10 && (
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">
                  Only {product.stock_qty} left in stock!
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-1">
              {/* Add to cart */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={cn(
                  "w-full flex items-center justify-center gap-2.5 rounded-full px-6 py-4 text-xs font-bold uppercase tracking-wider border border-foreground bg-white text-foreground hover:bg-foreground hover:text-white transition-all duration-200 btn-bounce-hover shadow-sm",
                  isOutOfStock && "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed",
                )}
              >
                {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                {isSoldOut
                  ? "Sold out"
                  : isOutOfStock
                    ? "Max quantity reached"
                    : added
                      ? "Added to cart!"
                      : "Add to cart"}
              </button>

              {/* Buy now */}
              {!isSoldOut && !isOutOfStock && (
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart();
                    navigate({ to: "/checkout", search: { orderId: undefined } });
                  }}
                  className="w-full flex items-center justify-center gap-2.5 rounded-full px-6 py-4 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-all btn-bounce-hover shadow-soft"
                >
                  Buy it now
                </button>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-line pt-1">
                {product.description}
              </p>
            )}

            {/* Share button */}
            <div className="flex justify-start border-t border-border/80 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: product.name, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/60 hover:text-primary transition-colors btn-bounce-hover"
              >
                <Upload className="w-4 h-4" />
                Share
              </button>
            </div>

            {/* Collapsible Accordions — only rendered for fields the admin filled in */}
            {accordions.length > 0 && (
              <div className="border-t border-border/80">
                {accordions.map(({ key, icon, title, content }) => (
                  <div key={key} className="border-b border-border/80">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(key)}
                      aria-expanded={openAccordion === key}
                      className="w-full flex items-center justify-between gap-3 py-4 text-left group"
                    >
                      <span className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        {icon}
                        {title}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-300",
                          openAccordion === key && "rotate-180",
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        openAccordion === key
                          ? "max-h-[60rem] opacity-100 pb-4"
                          : "max-h-0 opacity-0",
                      )}
                    >
                      <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-line">
                        {content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RELATED PRODUCTS ──────────────────────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="mt-20 pt-16 border-t border-border/80">
            <h2 className="font-display text-3xl text-brown font-bold mb-8">Related products</h2>
            <div className="grid grid-cols-2 min-[990px]:grid-cols-4 gap-[10px] min-[750px]:gap-[20px]">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
