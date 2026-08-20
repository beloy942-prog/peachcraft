import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getOrdersList, type OrderSummary } from "@/lib/api/supabase.functions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-[var(--blush)] text-[var(--foreground)]",
  confirmed: "bg-[var(--sage)] text-[var(--foreground)]",
  shipped: "bg-[var(--sage-deep)] text-[var(--foreground)]",
  delivered: "bg-[var(--cream)] text-[var(--foreground)]",
  cancelled: "bg-[#f87171] text-white",
};

const statusOrder = ["pending", "confirmed", "shipped", "delivered"];

function getTrackingProgress(status: string): number {
  const idx = statusOrder.indexOf(status);
  return idx >= 0 ? ((idx + 1) / statusOrder.length) * 100 : 0;
}

export const Route = createFileRoute("/admin/orders/tracking")({
  component: AdminOrderTrackingPage,
});

function AdminOrderTrackingPage() {
  const { data, isLoading, error } = useQuery<OrderSummary[]>({
    queryKey: ["admin-tracking"],
    queryFn: getOrdersList,
  });

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.filter((order) => {
      if (q && !order.id.toLowerCase().includes(q) && !order.user_email.toLowerCase().includes(q) && !(order.order_number ?? "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data, search]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-[var(--foreground)]/70">Orders</p>
        <h1 className="mt-2 text-4xl font-semibold text-[var(--foreground)]">Order Tracking</h1>
        <p className="mt-2 text-sm text-[var(--foreground)]/70">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--foreground)]/50" />
        <Input
          placeholder="Search by order ID or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-3xl bg-[var(--card)] shadow-soft" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-3xl bg-[var(--card)] p-6 text-sm text-[#f87171]">{error instanceof Error ? error.message : "Could not load orders."}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[var(--card)] p-12 shadow-soft">
          <p className="text-lg font-medium text-[var(--foreground)]">No orders found</p>
          <p className="mt-1 text-sm text-[var(--foreground)]/70">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((order) => (
            <Link
              key={order.id}
              to="/admin/orders/$id"
              params={{ id: order.id }}
              className="block rounded-3xl bg-[var(--card)] p-6 shadow-soft transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[var(--foreground)]">#{order.order_number ?? order.id.slice(0, 8)}</span>
                    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusColors[order.status] ?? "bg-[var(--card)] text-[var(--foreground)]")}>{order.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--foreground)]/70">{order.user_email}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--foreground)]">₱{order.total_amount.toLocaleString("en-PH")}</p>
                  <p className="text-xs text-[var(--foreground)]/60">{format(new Date(order.created_at), "MMM d, yyyy")}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex h-2 overflow-hidden rounded-full bg-[var(--background)]">
                  {statusOrder.map((s) => {
                    const orderIdx = statusOrder.indexOf(order.status);
                    const currentIdx = statusOrder.indexOf(s);
                    const filled = currentIdx <= orderIdx && orderIdx >= 0;
                    return (
                      <div
                        key={s}
                        className={cn(
                          "flex-1 transition-colors",
                          currentIdx > 0 && "ml-0.5",
                          filled ? "bg-[var(--sage-deep)]" : "bg-transparent",
                          currentIdx === orderIdx && "bg-[var(--sage-deep)]",
                        )}
                      />
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-[var(--foreground)]/50">
                  {statusOrder.map((s) => (
                    <span key={s} className="capitalize">{s}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
