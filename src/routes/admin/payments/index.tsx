import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Check, X, Loader2, ExternalLink, Search } from "lucide-react";
import { getAdminPayments, getAdminPaymentsPendingOrders, verifyGCashPayment } from "@/lib/api/supabase.functions";
import type { GCashPaymentRow } from "@/lib/api/supabase.functions";

export const Route = createFileRoute("/admin/payments/")({
  component: AdminPaymentsPage,
  head: () => ({
    meta: [{ title: "Payments — Peach Craft Admin" }],
  }),
});

type TabKey = "needs_review" | "verified" | "rejected" | "pending_orders";

const tabs: { key: TabKey; label: string }[] = [
  { key: "needs_review", label: "Needs Review" },
  { key: "pending_orders", label: "Pending Submission" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminPaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("needs_review");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const needsReviewQuery = useQuery({
    queryKey: ["admin-payments", "needs_review"],
    queryFn: () => getAdminPayments({ data: { status: "pending" } }),
  });

  const verifiedQuery = useQuery({
    queryKey: ["admin-payments", "verified"],
    queryFn: () => getAdminPayments({ data: { status: "verified" } }),
  });

  const rejectedQuery = useQuery({
    queryKey: ["admin-payments", "rejected"],
    queryFn: () => getAdminPayments({ data: { status: "rejected" } }),
  });

  const pendingOrdersQuery = useQuery({
    queryKey: ["admin-payments", "pending-orders"],
    queryFn: getAdminPaymentsPendingOrders,
  });

  const verifyMutation = useMutation({
    mutationFn: async (params: { payment_id: string; action: "approve" | "reject" }) => {
      return verifyGCashPayment({ data: params });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const handleVerify = async (paymentId: string, action: "approve" | "reject") => {
    setActionLoading(paymentId);
    try {
      await verifyMutation.mutateAsync({ payment_id: paymentId, action });
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const currentPayments = activeTab === "needs_review"
    ? needsReviewQuery.data?.payments ?? []
    : activeTab === "verified"
      ? verifiedQuery.data?.payments ?? []
      : activeTab === "rejected"
        ? rejectedQuery.data?.payments ?? []
        : [];

  const isLoading = activeTab === "needs_review"
    ? needsReviewQuery.isLoading
    : activeTab === "verified"
      ? verifiedQuery.isLoading
      : activeTab === "rejected"
        ? rejectedQuery.isLoading
        : pendingOrdersQuery.isLoading;

  const error = activeTab === "needs_review"
    ? needsReviewQuery.error
    : activeTab === "verified"
      ? verifiedQuery.error
      : activeTab === "rejected"
        ? rejectedQuery.error
        : pendingOrdersQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-4xl font-display text-brown">Payments</h1>
          <p className="text-sm text-foreground/70 mt-1">Manual GCash payment verification</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const count = tab.key === "needs_review"
            ? (needsReviewQuery.data?.payments?.length ?? 0)
            : tab.key === "verified"
              ? (verifiedQuery.data?.payments?.length ?? 0)
              : tab.key === "rejected"
                ? (rejectedQuery.data?.payments?.length ?? 0)
                : (pendingOrdersQuery.data?.orders?.length ?? 0);

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-wine text-wine"
                  : "border-transparent text-foreground/60 hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs rounded-full bg-muted px-2 py-0.5">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to load payments."}
        </div>
      ) : activeTab === "pending_orders" ? (
        /* Pending Orders tab — orders with no proof submitted yet */
        pendingOrdersQuery.data?.orders?.length === 0 ? (
          <div className="text-center py-20 text-foreground/50">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No orders awaiting payment submission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="p-4 font-medium text-foreground/70">Order ID</th>
                  <th className="p-4 font-medium text-foreground/70">Amount</th>
                  <th className="p-4 font-medium text-foreground/70">Date</th>
                  <th className="p-4 font-medium text-foreground/70">Status</th>
                  <th className="p-4 font-medium text-foreground/70">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrdersQuery.data?.orders?.map((order) => (
                  <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-4 font-mono text-xs">{order.order_number ?? order.id.slice(0, 8)}</td>
                    <td className="p-4">₱{Number(order.total_amount).toLocaleString()}</td>
                    <td className="p-4 text-foreground/70">{formatDate(order.created_at)}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Awaiting Payment
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/admin/orders/$id", params: { id: order.id } })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-wine hover:underline"
                      >
                        View Order <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : currentPayments.length === 0 ? (
        <div className="text-center py-20 text-foreground/50">
          <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {activeTab === "needs_review"
              ? "No payments pending review."
              : activeTab === "verified"
                ? "No verified payments yet."
                : "No rejected payments."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="p-4 font-medium text-foreground/70">Order ID</th>
                <th className="p-4 font-medium text-foreground/70">Amount</th>
                <th className="p-4 font-medium text-foreground/70">Customer</th>
                <th className="p-4 font-medium text-foreground/70">GCash Ref No.</th>
                <th className="p-4 font-medium text-foreground/70">Screenshot</th>
                <th className="p-4 font-medium text-foreground/70">Submitted</th>
                {activeTab === "needs_review" && <th className="p-4 font-medium text-foreground/70">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {currentPayments.map((payment: any) => (
                <tr key={payment.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-4 font-mono text-xs">{payment.orders?.order_number ?? payment.order_id.slice(0, 8)}</td>
                  <td className="p-4">₱{Number(payment.orders?.total_amount ?? 0).toLocaleString()}</td>
                  <td className="p-4 max-w-[160px] truncate" title={payment.customer_email}>
                    {payment.customer_email}
                  </td>
                  <td className="p-4 font-mono text-xs">{payment.gcash_reference_number}</td>
                  <td className="p-4">
                    {payment.screenshot_url ? (
                      <a
                        href={payment.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-wine hover:underline"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                  <td className="p-4 text-foreground/70 text-xs">{formatDate(payment.submitted_at)}</td>
                  {activeTab === "needs_review" && (
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleVerify(payment.id, "approve")}
                          disabled={actionLoading === payment.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === payment.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerify(payment.id, "reject")}
                          disabled={actionLoading === payment.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
