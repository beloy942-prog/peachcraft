import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { getOrdersList, type OrderSummary } from "@/lib/api/supabase.functions";

const statuses = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
const statusColors: Record<string, string> = {
  pending: "bg-[var(--blush)] text-[var(--foreground)]",
  confirmed: "bg-[var(--sage)] text-[var(--foreground)]",
  shipped: "bg-[var(--sage-deep)] text-[var(--foreground)]",
  delivered: "bg-[var(--cream)] text-[var(--foreground)]",
  cancelled: "bg-[#f87171] text-[var(--foreground)]",
};

export const Route = createFileRoute("/admin/orders/")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const { data, isLoading, error } = useQuery<OrderSummary[]>({
    queryKey: ["admin-orders"],
    queryFn: getOrdersList,
  });
  const [filter, setFilter] = useState<string>("all");
  const [newOrderMessage, setNewOrderMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  useEffect(() => {
    if (data) {
      setOrders(data);
    }
  }, [data]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          setOrders((current) => [
            {
              id: raw.id as string,
              order_number: (raw.order_number as string) ?? null,
              user_email: "Loading...",
              total_amount: raw.total_amount as number,
              status: raw.status as string,
              created_at: raw.created_at as string,
            },
            ...current,
          ]);
          setNewOrderMessage(`New order ${(raw.order_number as string ?? (raw.id as string).slice(0, 8))} received!`);
          window.setTimeout(() => setNewOrderMessage(null), 5000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((order) => order.status === filter);
  }, [filter, orders]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--foreground)]/70">Orders</p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-semibold text-[var(--foreground)]">Order management</h1>
          <p className="mt-2 text-sm text-[var(--foreground)]/70">Total {orders.length} orders</p>
        </div>
      </div>

      {newOrderMessage && (
        <div className="rounded-3xl bg-[var(--sage)]/10 p-4 text-sm text-[var(--foreground)]">{newOrderMessage}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition",
              filter === status
                ? "bg-[var(--sage)] text-[var(--foreground)]"
                : "bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--foreground)]/10",
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 rounded-3xl bg-[var(--card)] shadow-soft" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-3xl bg-[var(--card)] p-6 text-sm text-[#f87171]">{error instanceof Error ? error.message : "Could not load orders."}</p>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filteredOrders.map((order) => (
              <div key={order.id} className="rounded-2xl bg-[var(--card)] p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-semibold text-sm text-[var(--foreground)]">#{order.order_number ?? order.id.slice(0, 8)}</span>
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColors[order.status] ?? "bg-[var(--card)] text-[var(--foreground)]")}>{order.status}</span>
                </div>
                <p className="text-xs text-[var(--foreground)]/70 truncate mb-1">{order.user_email}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">₱{order.total_amount.toLocaleString("en-PH")}</span>
                  <span className="text-xs text-[var(--foreground)]/60">{format(new Date(order.created_at), "MMM d, yyyy")}</span>
                </div>
                <Link
                  to="/admin/orders/$id"
                  params={{ id: order.id }}
                  className="mt-3 inline-flex w-full justify-center rounded-full bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-soft hover:bg-[var(--foreground)]/10"
                >
                  View order
                </Link>
              </div>
            ))}
            {filteredOrders.length === 0 && (
              <p className="rounded-3xl bg-[var(--card)] p-6 text-sm text-[var(--foreground)]/60 text-center">No orders found.</p>
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--background)] text-[var(--foreground)]/75">
                <tr>
                  <th className="px-5 py-4">Order</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">View</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-t border-[var(--border)]">
                    <td className="px-5 py-4 font-semibold text-[var(--foreground)]">{order.order_number ?? order.id.slice(0, 8)}</td>
                    <td className="px-5 py-4 text-[var(--foreground)]/80 truncate max-w-[140px]">{order.user_email}</td>
                    <td className="px-5 py-4 text-[var(--foreground)]">₱{order.total_amount.toLocaleString("en-PH")}</td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusColors[order.status] ?? "bg-[var(--card)] text-[var(--foreground)]")}>{order.status}</span>
                    </td>
                    <td className="px-5 py-4 text-[var(--foreground)]/80">{format(new Date(order.created_at), "MMM d, yyyy")}</td>
                    <td className="px-5 py-4">
                      <Link
                        to="/admin/orders/$id"
                        params={{ id: order.id }}
                        className="inline-flex rounded-full bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-soft hover:bg-[var(--foreground)]/10"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
