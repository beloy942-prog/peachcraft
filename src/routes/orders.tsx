import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { getCustomerOrders, cancelCustomerOrder, getGuestOrders, cancelGuestOrder } from "@/lib/api/supabase.functions";
import { useCurrency } from "@/lib/currency-context";
import { Package, XCircle, Loader2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
});

type OrderItem = {
  product_id: string;
  name: string;
  image: string | null;
  qty: number;
  price_at_purchase: number;
};

type Order = {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  shipping_address: Record<string, string> | null;
  payment_method: string | null;
  payment_status: string | null;
  items: OrderItem[];
};

type TabKey = "active" | "arrived" | "cancelled";

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: "active", label: "On Shipping", statuses: ["pending", "confirmed", "shipped"] },
  { key: "arrived", label: "Arrived", statuses: ["delivered"] },
  { key: "cancelled", label: "Canceled", statuses: ["cancelled"] },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border-amber-200",
  confirmed: "bg-blue-50 text-blue-600 border-blue-200",
  shipped: "bg-orange-50 text-orange-600 border-orange-200",
  delivered: "bg-green-50 text-green-600 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "On Deliver",
  delivered: "Arrived",
  cancelled: "Canceled",
};

/** Display order number: prefer server-stored order_number, fall back to UUID-based format. */
function displayOrderId(order: { id: string; order_number?: string | null }): string {
  if (order.order_number) return order.order_number;
  const raw = order.id.replace(/-/g, "").toUpperCase();
  const prefix = raw.slice(0, 3);
  const suffix = raw.slice(-5);
  return `CTH-${prefix}${suffix}`;
}

function formatAddress(addr: Record<string, string> | null): string {
  if (!addr) return "—";
  const parts = [addr.city, addr.province].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function estimateArrival(createdAt: string, status: string): string | null {
  if (status !== "shipped" && status !== "confirmed") return null;
  const days = status === "shipped" ? 7 : 14;
  const d = new Date(createdAt);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OrdersPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestSearched, setGuestSearched] = useState(false);
  const [guestLookupError, setGuestLookupError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { loading: authLoading, session: authSession } = useAuth();
  const isGuest = !authSession;

  useEffect(() => {
    if (authLoading) return;
    if (!authSession) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setAccessToken(authSession.access_token);

    (async () => {
      try {
        const data = await getCustomerOrders({ data: { accessToken: authSession.access_token } });
        if (mounted) setOrders(data);
      } catch {
        // AbortError from StrictMode double-mount is expected
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [authLoading, authSession, navigate]);

  const handleGuestLookup = async () => {
    const trimmed = guestEmail.trim();
    if (!trimmed) {
      setGuestLookupError("Please enter the email you used at checkout.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setGuestLookupError("Please enter a valid email address.");
      return;
    }
    setGuestLookupError(null);
    setLoading(true);
    try {
      const data = await getGuestOrders({ data: { email: trimmed } });
      setOrders(data);
      setGuestSearched(true);
    } catch {
      setGuestLookupError("We couldn't find any orders for that email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    setConfirmId(null);
    setCancellingId(orderId);
    try {
      if (isGuest) {
        await cancelGuestOrder({ data: { orderId, email: guestEmail.trim() } });
      } else {
        await cancelCustomerOrder({ data: { orderId, accessToken: accessToken ?? undefined } });
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)),
      );
    } catch {
      // Error is handled silently — user can retry
    } finally {
      setCancellingId(null);
    }
  };

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const visibleOrders = orders.filter((o) => activeTab.statuses.includes(o.status));

  function countForTab(key: TabKey) {
    const t = TABS.find((t) => t.key === key)!;
    return orders.filter((o) => t.statuses.includes(o.status)).length;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
      </div>
    );
  }

  // Guest mode: no account required — find orders by checkout email.
  if (isGuest && !guestSearched) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-5 py-8 sm:py-12">
          <h1 className="text-[26px] font-display font-medium text-gray-900 -tracking-[0.03em] mb-7">
            My Orders
          </h1>
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_-6px_rgba(0,0,0,0.10)] px-6 py-8 text-center space-y-5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Package className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-gray-900">Find your orders</p>
              <p className="mt-1.5 text-sm text-gray-500">
                No account needed. Enter the email you used at checkout to view and track your orders.
              </p>
            </div>
            <div className="space-y-2.5 text-left">
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGuestLookup(); }}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
              {guestLookupError && (
                <p className="text-xs font-medium text-red-600">{guestLookupError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleGuestLookup}
              className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_12px_-3px_rgba(0,0,0,0.25)] hover:bg-gray-800 transition-colors"
            >
              Find Orders
            </button>
            <p className="text-xs text-gray-400">
              Have an account?{" "}
              <Link to="/login" search={{ redirect: "/orders" }} className="font-medium text-gray-600 underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto lg:max-w-2xl xl:max-w-3xl px-5 py-8 sm:py-12">
        {/* Header */}
        <h1 className="text-[26px] font-display font-medium text-gray-900 -tracking-[0.03em] mb-7">
          My Orders
        </h1>

        {/* Tab bar */}
        {orders.length > 0 && (
          <div className="flex gap-2.5 mb-7 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const count = countForTab(t.key);
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-[18px] py-[9px] text-[13px] font-medium transition-all shrink-0 ${
                    active
                      ? "bg-gray-900 text-white shadow-[0_2px_12px_-3px_rgba(0,0,0,0.25)]"
                      : "bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full px-[7px] text-[11px] font-medium ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {visibleOrders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_-6px_rgba(0,0,0,0.10)] px-8 py-14 text-center space-y-4">
            <Package className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-medium text-gray-400">
              {orders.length === 0
                ? (isGuest ? "No orders found for this email." : "No orders yet.")
                : `No orders in "${activeTab.label}".`}
            </p>
            {orders.length === 0 && (
              <Link
                to="/shop"
                className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_12px_-3px_rgba(0,0,0,0.25)] hover:bg-gray-800 transition-colors"
              >
                Start Shopping
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {visibleOrders.map((order) => {
              const eta = estimateArrival(order.created_at, order.status);
              const shipAddr = order.shipping_address;
              const destination = shipAddr ? [shipAddr.city, shipAddr.province, shipAddr.country].filter(Boolean).join(", ") : "—";

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-[0_2px_24px_-6px_rgba(0,0,0,0.10)] p-5 space-y-5"
                >
                  {/* Header: Order number + status badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Package className="w-[18px] h-[18px] text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[15px] font-medium text-gray-900 tracking-tight">
                          {displayOrderId(order)}
                        </p>
                        <p className="text-[12px] text-gray-400 font-medium">Order</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium shrink-0 mt-0.5 ${
                        STATUS_STYLE[order.status] ?? "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      {order.status === "shipped" && (
                        <span className="w-[7px] h-[7px] rounded-full bg-orange-500 shrink-0" />
                      )}
                      {STATUS_LABEL[order.status] ?? order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>

                  {/* Shipping tracker — active orders only */}
                  {["pending", "confirmed", "shipped"].includes(order.status) && shipAddr && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3.5">
                      <div className="flex items-center gap-0">
                        {/* Origin */}
                        <div className="flex-shrink-0 max-w-[100px]">
                          <p className="text-[11px] font-medium text-gray-800 leading-tight truncate">
                            Quezon City, Philippines
                          </p>
                        </div>

                        {/* Dotted path */}
                        <div className="flex-1 flex items-center justify-center px-1">
                          <div className="flex items-center w-full max-w-[80px]">
                            <div className="h-px flex-1 border-t border-dashed border-gray-300" />
                          </div>
                        </div>

                        {/* ETA */}
                        {eta && (
                          <div className="flex-shrink-0 text-center px-1">
                            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wide leading-tight">
                              Est. arrival
                            </p>
                            <p className="text-[10px] font-medium text-gray-700 leading-tight whitespace-nowrap">
                              {eta}
                            </p>
                          </div>
                        )}

                        {/* Dotted path */}
                        <div className="flex-1 flex items-center justify-center px-1">
                          <div className="flex items-center w-full max-w-[80px]">
                            <div className="h-px flex-1 border-t border-dashed border-gray-300" />
                          </div>
                        </div>

                        {/* Destination */}
                        <div className="flex-shrink-0 max-w-[110px] text-right">
                          <p className="text-[11px] font-medium text-gray-800 leading-tight truncate">
                            {destination}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t border-gray-100" />

                  {/* Product rows */}
                  {order.items.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-3.5">
                      <div className="w-[68px] h-[68px] rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-gray-900 truncate leading-snug">
                          {item.name}
                        </p>
                        <p className="text-[13px] font-medium text-gray-700 mt-1">
                          {formatPrice(item.price_at_purchase)} <span className="font-medium text-gray-400">x{item.qty}</span>
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Divider */}
                  <div className="border-t border-gray-100" />

                  {/* Footer: Total + Details button */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-gray-400">Total</p>
                      <p className="text-[17px] font-medium text-gray-900 tracking-tight">
                        {formatPrice(order.total_amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-5 py-2 text-[12px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      Details
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedId === order.id ? "rotate-90" : ""}`} />
                    </button>
                  </div>

                  {/* Expandable details panel */}
                  {expandedId === order.id && (
                    <div className="rounded-xl bg-gray-50 px-4 py-3.5 text-xs space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Order date</span>
                        <span className="font-medium text-gray-800">
                          {new Date(order.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Payment</span>
                        <span className="font-medium text-gray-800">
                          {order.payment_method === "gcash" ? "GCash" : "Cash on Delivery"}
                        </span>
                      </div>
                      {shipAddr && (
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-medium">Shipping address</span>
                          <span className="font-medium text-gray-800 text-right max-w-[60%]">
                            {[
                              shipAddr.street,
                              shipAddr.city,
                              shipAddr.province,
                              shipAddr.zip,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancel button — pending only */}
                  {order.status === "pending" && order.payment_method === "gcash" && order.payment_status === "pending" && (
                    <div>
                      {confirmId === order.id ? (
                        <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3">
                          <p className="text-sm font-medium text-red-700 flex-1">Cancel this order?</p>
                          <button
                            type="button"
                            onClick={() => handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {cancellingId === order.id ? "Cancelling..." : "Yes, cancel"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => navigate({ to: "/checkout", search: { orderId: order.id } })}
                            className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Continue to Check out
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(order.id)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> Cancel Order
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
