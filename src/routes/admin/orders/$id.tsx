import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { updateOrderStatus, getOrderDetails, type OrderDetail } from "@/lib/api/supabase.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusOptions = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = (typeof statusOptions)[number];
const statusColors: Record<string, string> = {
  pending: "bg-[var(--blush)] text-[var(--foreground)]",
  confirmed: "bg-[var(--sage)] text-[var(--foreground)]",
  shipped: "bg-[var(--sage-deep)] text-[var(--foreground)]",
  delivered: "bg-[var(--cream)] text-[var(--foreground)]",
  cancelled: "bg-[#f87171] text-[var(--foreground)]",
};

export const Route = createFileRoute("/admin/orders/$id")({
  component: AdminOrderDetailPage,
});

function AdminOrderDetailPage() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus>(statusOptions[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, error: loadError } = useQuery<OrderDetail | null>({
    queryKey: ["admin-order", params.id],
    queryFn: () => getOrderDetails({ data: { id: params.id! } }),
    enabled: Boolean(params.id),
  });

  useEffect(() => {
    if (data) {
      setStatus(data.status as OrderStatus);
    }
  }, [data]);

  useEffect(() => {
    if (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load order.";
      if (message.includes("not found")) {
        navigate({ to: "/admin/orders" });
      }
      setError(message);
    }
  }, [loadError, navigate]);

  const handleStatusUpdate = async () => {
    if (!data) return;
    setError(null);
    setIsSaving(true);

    try {
      await updateOrderStatus({ data: { id: data.id, status } });
      toast.success(`Order status updated to ${status}`);
      navigate({ to: "/admin/orders" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update status.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-96 rounded-3xl bg-[var(--card)] shadow-soft" />;
  }

  if (!data) {
    return <p className="text-sm text-[#f87171]">Order not found.</p>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--foreground)]/70">Order #{data.order_number ?? data.id.slice(0, 8)}</p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-semibold text-[var(--foreground)]">Order details</h1>
        </div>
        <div className="self-start sm:self-auto rounded-3xl bg-[var(--card)] px-4 py-2.5 sm:px-5 sm:py-3 shadow-soft">
          <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-semibold", statusColors[data.status] ?? "bg-[var(--foreground)] text-[var(--background)]")}>{data.status}</span>
        </div>
      </div>

      {error && <div className="rounded-3xl bg-[#f87171]/10 p-4 text-sm text-[#991b1b]">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl bg-[var(--card)] p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-[var(--foreground)]/70">Customer</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{data.customer.name ?? "Customer"}</p>
              <p className="text-sm text-[var(--foreground)]/80">{data.customer.email}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground)]/70">Order placed</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{format(new Date(data.created_at), "MMM d, yyyy")}</p>
              <p className="text-sm text-[var(--foreground)]/80">Total: ₱{data.total_amount.toLocaleString("en-PH")}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-[var(--background)] p-5">
            <p className="text-sm text-[var(--foreground)]/70">Shipping address</p>
            <p className="mt-3 text-[var(--foreground)]">{data.shipping_address?.street ?? "—"}</p>
            <p className="text-sm text-[var(--foreground)]/80">{data.shipping_address?.city ?? ""}, {data.shipping_address?.province ?? ""} {data.shipping_address?.zip ?? ""}</p>
          </div>
        </section>

        <section className="rounded-3xl bg-[var(--card)] p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Update status</h2>
          <label className="mt-4 block text-sm font-semibold text-[var(--foreground)]/80">Status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as OrderStatus)}
            className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 font-sans text-[var(--foreground)] outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option} className="bg-[var(--card)] text-[var(--foreground)]">
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleStatusUpdate}
            disabled={isSaving}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[var(--sage)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-soft hover:bg-[var(--sage-deep)] disabled:opacity-50"
          >
            {isSaving ? "Updating..." : "Update status"}
          </button>
        </section>
      </div>

      <section className="rounded-3xl bg-[var(--card)] p-4 sm:p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Items</h2>
        {/* Mobile card view */}
        <div className="mt-4 flex flex-col gap-3 sm:hidden">
          {data.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[var(--background)] p-3">
              {item.product_image ? (
                <img src={item.product_image} alt={item.product_name} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-[var(--card)]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.product_name}</p>
                <p className="text-xs text-[var(--foreground)]/60 mt-0.5">Qty: {item.qty} × ₱{item.price_at_purchase.toLocaleString("en-PH")}</p>
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)] shrink-0">₱{(item.qty * item.price_at_purchase).toLocaleString("en-PH")}</span>
            </div>
          ))}
        </div>
        {/* Desktop table view */}
        <div className="mt-4 hidden sm:block overflow-x-auto rounded-3xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--background)] text-[var(--foreground)]/75">
              <tr>
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Qty</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">Line total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-5 py-4 flex items-center gap-3 text-[var(--foreground)]">
                    {item.product_image ? (
                      <img src={item.product_image} alt={item.product_name} className="h-12 w-12 rounded-3xl object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-3xl bg-[var(--background)]" />
                    )}
                    <span className="truncate max-w-[140px]">{item.product_name}</span>
                  </td>
                  <td className="px-5 py-4 text-[var(--foreground)]">{item.qty}</td>
                  <td className="px-5 py-4 text-[var(--foreground)]">₱{item.price_at_purchase.toLocaleString("en-PH")}</td>
                  <td className="px-5 py-4 text-[var(--foreground)]">₱{(item.qty * item.price_at_purchase).toLocaleString("en-PH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
