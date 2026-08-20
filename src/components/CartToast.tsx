import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShoppingBag, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CartToastItem = {
  id: string;
  productName: string;
  productImage?: string | null;
  qty: number;
};

type CartToastContextValue = {
  notify: (item: Omit<CartToastItem, "id">) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const CartToastContext = createContext<CartToastContextValue | null>(null);

export function useCartToast() {
  const ctx = useContext(CartToastContext);
  if (!ctx) throw new Error("useCartToast must be used inside CartToastProvider");
  return ctx;
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({
  item,
  onDismiss,
}: {
  item: CartToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  const { itemCount } = useCart();

  // Animate in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(item.id), 300);
  }, [item.id, onDismiss]);

  // Auto-dismiss after 5s
  useEffect(() => {
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const handleViewCart = () => {
    dismiss();
    navigate({ to: "/cart" });
  };

  const handleCheckout = () => {
    dismiss();
    navigate({ to: "/checkout", search: { orderId: undefined } });
  };

  return (
    <>
      {/* ── MOBILE: Full-width bar below navbar ── */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "lg:hidden w-full bg-sage-deep text-background",
          "border-b border-white/10",
          "transition-all duration-300 ease-out overflow-hidden",
          visible && !leaving
            ? "opacity-100 max-h-[400px]"
            : "opacity-0 max-h-0",
        )}
      >
        <div className="px-4 py-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-background" strokeWidth={3} />
              <span className="text-sm font-semibold text-background">
                Item added to your cart
              </span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-background/60 hover:text-background transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product row */}
          <div className="flex items-center gap-4 mb-5">
            {item.productImage ? (
              <img
                src={item.productImage}
                alt={item.productName}
                className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/10 grid place-items-center shrink-0">
                <ShoppingBag className="w-6 h-6 text-background/60" />
              </div>
            )}
            <p className="text-base font-bold text-background leading-snug">
              {item.productName}
              {item.qty > 1 && (
                <span className="block text-sm font-normal text-background/70 mt-0.5">
                  Qty: {item.qty}
                </span>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleViewCart}
              className="w-full py-3 rounded-full border border-background/80 text-background text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              View my cart ({itemCount})
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:bg-background/90 transition-colors"
            >
              Check out
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-2 text-sm font-medium text-background underline underline-offset-2 hover:text-background/80 transition-colors text-center"
            >
              Continue shopping
            </button>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: Floating compact dropdown on the right ── */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "hidden lg:block",
          "w-[300px] bg-sage-deep text-background",
          "rounded-2xl shadow-[0_16px_48px_-8px_rgba(0,0,0,0.45)] border border-white/10",
          "overflow-hidden",
          "transition-all duration-300 ease-out",
          visible && !leaving
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-3 scale-95 pointer-events-none",
        )}
      >
        <div className="px-5 py-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-background" strokeWidth={3} />
              <span className="text-sm font-semibold text-background">
                Item added to your cart
              </span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-background/60 hover:text-background transition-colors p-1 -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product row */}
          <div className="flex items-center gap-3 mb-5">
            {item.productImage ? (
              <img
                src={item.productImage}
                alt={item.productName}
                className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/10 grid place-items-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-background/60" />
              </div>
            )}
            <p className="text-sm font-bold text-background leading-snug">
              {item.productName}
              {item.qty > 1 && (
                <span className="block text-xs font-normal text-background/70 mt-0.5">
                  Qty: {item.qty}
                </span>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleViewCart}
              className="w-full py-2.5 rounded-full border border-background/80 text-background text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              View my cart ({itemCount})
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full py-2.5 rounded-full bg-background text-foreground text-sm font-semibold hover:bg-background/90 transition-colors"
            >
              Check out
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-1.5 text-sm font-medium text-background underline underline-offset-2 hover:text-background/80 transition-colors text-center"
            >
              Continue shopping
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<CartToastItem[]>([]);
  const counterRef = useRef(0);

  const notify = useCallback((item: Omit<CartToastItem, "id">) => {
    const id = `cart-toast-${++counterRef.current}`;
    // Only show one at a time — replace previous
    setToasts([{ ...item, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <CartToastContext.Provider value={{ notify }}>
      {children}

      {/* ── Mobile wrapper: full-width bar just below sticky header ── */}
      {/* Header height: py-3 (24px) + h-14 (56px) = 80px = top-20 */}
      <div
        aria-label="Cart notifications"
        className="lg:hidden fixed top-20 left-0 right-0 z-40 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <CartPanel item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>

      {/* ── Desktop wrapper: floating dropdown on the right side below header ── */}
      {/* Header height: py-3 (24px) + h-16 (64px) = 88px */}
      <div
        aria-label="Cart notifications"
        className="hidden lg:block fixed top-[88px] right-6 z-40 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <CartPanel item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </CartToastContext.Provider>
  );
}
