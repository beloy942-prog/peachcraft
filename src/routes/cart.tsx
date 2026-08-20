import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency-context";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { items, itemCount, subtotal, updateQuantity, removeItem, clear } = useCart();
  const { formatPrice } = useCurrency();
  const { user: authUser } = useAuth();

  const shippingFee = 150;
  const taxAmount = 0;
  const totalAmount = subtotal + shippingFee + taxAmount;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto lg:max-w-2xl xl:max-w-3xl px-5 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <h1 className="text-[26px] font-display font-medium text-gray-900 -tracking-[0.03em]">
            Shopping Cart
          </h1>
          <span className="text-[13px] font-medium text-gray-400 bg-gray-100 rounded-full px-3.5 py-1.5">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_-6px_rgba(0,0,0,0.10)] px-8 py-14 text-center space-y-4">
            <ShoppingBag className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-medium text-gray-400">Your cart is empty.</p>
            <p className="text-[13px] text-gray-400 -mt-2">Add some favorites before checking out.</p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_12px_-3px_rgba(0,0,0,0.25)] hover:bg-gray-800 transition-colors mt-2"
            >
              Shop now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.product_id}
                  className="bg-white rounded-2xl shadow-[0_2px_24px_-6px_rgba(0,0,0,0.10)] p-5 space-y-4"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Product image */}
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-gray-300" />
                      )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 truncate leading-snug">
                        {item.name}
                      </p>
                      <p className="text-[14px] font-medium text-gray-700 mt-1">
                        {formatPrice(item.price)}
                      </p>
                      {item.stock_qty != null && (
                        <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                          {item.stock_qty} left in stock
                        </p>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.product_id)}
                      aria-label={`Remove ${item.name}`}
                      className="p-2 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 -mr-1"
                    >
                      <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center gap-0 rounded-full border border-gray-200 bg-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.qty - 1)}
                        disabled={item.qty <= 1}
                        aria-label={`Decrease quantity for ${item.name}`}
                        className="grid place-items-center h-9 w-9 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[2rem] text-center text-[13px] font-medium text-gray-900 select-none">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.qty + 1)}
                        aria-label={`Increase quantity for ${item.name}`}
                        className="grid place-items-center h-9 w-9 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[15px] font-medium text-gray-900">
                      {formatPrice(item.price * item.qty)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 bg-white rounded-2xl shadow-[0_2px_24px_-6px_rgba(0,0,0,0.10)] p-5 space-y-4">
              <p className="text-[13px] font-medium text-gray-400 uppercase tracking-wide">
                Order summary
              </p>

              <div className="space-y-2.5 text-[14px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-800">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span className="font-medium text-gray-800">{formatPrice(shippingFee)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-medium text-gray-800">{formatPrice(taxAmount)}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3.5" />

              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-gray-900">Total</span>
                <span className="text-[18px] font-medium text-gray-900">
                  {formatPrice(totalAmount)}
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/checkout", search: { orderId: undefined } })}
                  className="w-full rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-[0_2px_12px_-3px_rgba(0,0,0,0.25)] hover:bg-gray-800 transition-colors"
                >
                  Proceed to checkout
                </button>
                {!authUser && (
                  <p className="text-[12px] font-medium text-gray-400 text-center mt-2">
                    Have an account?{" "}
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/login", search: { redirect: "/checkout" } })}
                      className="underline underline-offset-2 hover:text-gray-600"
                    >
                      Log in
                    </button>{" "}
                    for faster checkout.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={clear}
                className="w-full rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[13px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Empty cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
