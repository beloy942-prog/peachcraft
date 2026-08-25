import { useState } from "react";
import { Heart, ShoppingCart, Check } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/supabase";

export function ProductCard({ product, formattedPrice }: { product: Product; formattedPrice?: string }) {
  const [liked, setLiked] = useState(false);
  const [addedState, setAddedState] = useState<"idle" | "adding" | "added">("idle");
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const imageSrc = product.images?.[0] ?? null;
  const secondImageSrc = product.images?.[1] ?? null;
  const isSoldOut =
    product.soldOut ||
    (product.stock_qty !== undefined &&
      product.stock_qty !== null &&
      product.stock_qty <= 0);

  const isNew = product.tag?.toLowerCase().includes("new");
  const isLimited = product.tag?.toLowerCase().includes("limited");

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut || addedState !== "idle") return;
    setAddedState("adding");
    try {
      addItem(product, 1);
      setAddedState("added");
      setTimeout(() => setAddedState("idle"), 1400);
    } catch {
      setAddedState("idle");
    }
  };

  return (
    <>
      <article
        onClick={() => navigate({ to: `/shop/${product.id}` })}
        className="group cursor-pointer flex flex-col bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden"
      >
        {/* ── Image area ─────────────────────────────────────────── */}
        <div className="relative bg-neutral-50 aspect-square overflow-hidden">
          {imageSrc ? (
            <div className="hm-media absolute inset-0">
              <img
                src={imageSrc}
                alt={product.name}
                className="hm-img w-full h-full object-cover"
                loading="lazy"
              />
              {secondImageSrc && (
                <img
                  src={secondImageSrc}
                  alt=""
                  className="hm-img hm-img-alt w-full h-full object-cover absolute inset-0"
                  loading="lazy"
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl opacity-20">🎂</span>
            </div>
          )}

          {/* Badges — top left */}
          {isSoldOut && (
            <span className="absolute top-3 left-3 z-10 bg-neutral-900 text-white text-[10px] font-medium px-3 py-1 rounded-full tracking-wide shadow-sm select-none">
              Sold out
            </span>
          )}
          {!isSoldOut && isLimited && (
            <span className="absolute top-3 left-3 z-10 bg-neutral-800 text-white text-[10px] font-medium px-3 py-1 rounded-full tracking-wide shadow-sm select-none">
              Limited
            </span>
          )}
          {!isSoldOut && isNew && !isLimited && (
            <span className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-[10px] font-medium px-3 py-1 rounded-full tracking-wide shadow-sm select-none">
              New
            </span>
          )}

          {/* Wishlist — top right */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLiked((v) => !v);
            }}
            aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={liked}
            className="absolute right-3 top-3 z-10 grid place-items-center w-8 h-8 rounded-full bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Heart
              className={cn(
                "w-3.5 h-3.5 transition-colors",
                liked ? "fill-rose-500 text-rose-500" : "text-neutral-400"
              )}
            />
          </button>

          {/* Quick Add — slides up from bottom on hover */}
          {!isSoldOut && (
            <div className="hm-quick-add">
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={addedState !== "idle"}
                aria-label={`Add ${product.name} to cart`}
                className="hm-quick-add-btn"
              >
                {addedState === "added" ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                    <span>Quick add</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Info ───────────────────────────────────────────────── */}
        <div className="p-3 sm:p-4 flex flex-col gap-0.5 flex-grow">
          <h3 className="font-medium text-neutral-900 text-xs sm:text-sm leading-snug line-clamp-2 mb-0.5">
            <Link
              to="/shop/$id"
              params={{ id: product.id }}
              id={`CardLink-${product.id}`}
              className="text-inherit no-underline hover:text-neutral-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {product.name}
            </Link>
          </h3>
          <p className={cn(
            "text-xs sm:text-sm font-normal",
            isSoldOut ? "text-neutral-400 line-through" : "text-neutral-600"
          )}>
            {formattedPrice ?? formatPrice(product.price)}
          </p>
        </div>
      </article>

      <style>{`
        /* Image swap on hover */
        .hm-media { width: 100%; height: 100%; }
        .hm-img { transition: transform 480ms ease-out, opacity 360ms ease; }
        .group:hover .hm-img { transform: scale(1.04); }
        .hm-img-alt {
          opacity: 0;
          z-index: 2;
          position: absolute;
          top: 0; left: 0;
        }
        .group:hover .hm-img:first-child:not(:only-child) { opacity: 0; }
        .group:hover .hm-img-alt { opacity: 1; }

        /* Quick Add */
        .hm-quick-add {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          z-index: 10;
          transform: translateY(100%);
          opacity: 0;
          transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms ease;
        }
        @media (hover: hover) {
          .group:hover .hm-quick-add {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @media (hover: none) {
          .hm-quick-add { transform: translateY(0); opacity: 1; }
        }
        .hm-quick-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 8px 12px;
          background: #171717;
          color: #ffffff;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: background 140ms ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .hm-quick-add-btn:hover:not(:disabled) { background: #262626; }
        .hm-quick-add-btn:disabled { background: #404040; cursor: default; }
        @media (min-width: 640px) {
          .hm-quick-add-btn { font-size: 12px; }
        }
      `}</style>
    </>
  );
}
