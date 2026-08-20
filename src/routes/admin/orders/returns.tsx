import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getOrdersList, type OrderSummary } from "@/lib/api/supabase.functions";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-[var(--blush)] text-[var(--foreground)]",
  cancelled: "bg-[#f87171] text-white",
};

export const Route = createFileRoute("/admin/orders/returns")({
  component: AdminReturnsPage,
});

function AdminReturnsPage() {
  const { data, isLoading, error } = useQuery<OrderSummary[]>({
    queryKey: ["admin-returns"],
    queryFn: getOrdersList,
  });

  const returns = useMemo(() => {
    if (!data) return [];
    return data.filter((order) => order.status === "cancelled");
  }, [data]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-[var(--foreground)]/70">Orders</p>
        <h1 className="mt-2 text-2xl md:text-4xl font-semibold text-[var(--foreground)]">Returns</h1>
        <p className="mt-2 text-sm text-[var(--foreground)]/70">{returns.length} cancelled order{returns.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 rounded-3xl bg-[var(--card)] shadow-soft" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-3xl bg-[var(--card)] p-6 text-sm text-[#f87171]">{error instanceof Error ? error.message : "Could not load returns."}</p>
      ) : returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[var(--card)] p-12 shadow-soft">
          <p className="text-lg font-medium text-[var(--foreground)]">No returns yet</p>
          <p className="mt-1 text-sm text-[var(--foreground)]/70">Cancelled orders will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--background)] text-[var(--foreground)]/75">
              <tr>
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((order) => (
                <tr key={order.id} className="border-t border-[var(--border)]">
                  <td className="px-5 py-4 font-semibold text-[var(--foreground)]">{order.order_number ?? order.id.slice(0, 8)}</td>
                  <td className="px-5 py-4 text-[var(--foreground)]/80">{order.user_email}</td>
                  <td className="px-5 py-4 text-[var(--foreground)]">₱{order.total_amount.toLocaleString("en-PH")}</td>
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusColors[order.status] ?? "bg-[var(--card)] text-[var(--foreground)]")}>{order.status}</span>
                  </td>
                  <td className="px-5 py-4 text-[var(--foreground)]/80">{format(new Date(order.created_at), "MMM d, yyyy")}</td>
                  <td className="px-5 py-4">
                    <Link
                      to="/admin/orders/$id"
                      params={{ id: order.id }}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--sage)] px-4 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-soft transition hover:bg-[var(--sage-deep)]"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
