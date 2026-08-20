import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServer } from "../supabase";
import { verifyAdmin } from "./admin-auth";

export type DashboardActivity = {
  type: "new_order" | "low_stock" | "new_user" | "payment";
  title: string;
  subtitle: string;
  time: string;
  badge: { label: string; color: string };
};

export type DashboardData = {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockCount: number;
  revenueByMonth: { month: string; revenue: number }[];
  categories: { name: string; count: number }[];
  recentActivity: DashboardActivity[];
  topProducts: {
    id: string;
    name: string;
    image: string | null;
    stocks: number;
    price: number;
    sales: number;
    earnings: number;
  }[];
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;
  return `${Math.floor(diffSec / 604800)} weeks ago`;
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();

  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [
    { count: totalProducts, error: prodErr },
    { data: allOrders, error: ordersErr },
    { count: lowStockCount, error: lowStockErr },
    { data: categoryData, error: catErr },
    { data: items, error: itemsErr },
    { data: recentUsers, error: usersErr },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("orders")
      .select("id,order_number,total_amount,status,user_id,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .lt("stock_qty", 5)
      .eq("is_active", true),
    supabase
      .from("products")
      .select("category")
      .eq("is_active", true),
    supabase
      .from("order_items")
      .select("product_id,qty,price_at_purchase"),
    supabase
      .from("profiles")
      .select("id,email,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (prodErr) throw prodErr;
  if (ordersErr) throw ordersErr;
  if (lowStockErr) throw lowStockErr;
  if (catErr) throw catErr;
  if (itemsErr) throw itemsErr;
  if (usersErr) throw usersErr;

  const orders = allOrders ?? [];

  const completedOrders = orders.filter(
    (o) => o.status === "delivered" || o.status === "confirmed",
  );
  const nonCancelledOrders = orders.filter((o) => o.status !== "cancelled");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalOrders = nonCancelledOrders.length;

  // Revenue by month (last 12 months)
  const monthLabels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const revenueMap = new Map<string, number>();
  monthLabels.forEach((m) => revenueMap.set(m, 0));

  completedOrders
    .filter((o) => new Date(o.created_at) >= twelveMonthsAgo)
    .forEach((o) => {
      const key = o.created_at.slice(0, 7);
      if (revenueMap.has(key)) {
        revenueMap.set(key, revenueMap.get(key)! + Number(o.total_amount));
      }
    });

  const revenueByMonth = monthLabels.map((month) => ({
    month,
    revenue: revenueMap.get(month) ?? 0,
  }));

  // Category distribution
  const catCount = new Map<string, number>();
  (categoryData ?? []).forEach((p) => {
    const cat = p.category || "Uncategorized";
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
  });
  const categories = Array.from(catCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Top products
  const productSalesMap = new Map<string, { qty: number; earnings: number }>();
  (items ?? []).forEach((item) => {
    const existing = productSalesMap.get(item.product_id) ?? { qty: 0, earnings: 0 };
    existing.qty += item.qty;
    existing.earnings += item.qty * Number(item.price_at_purchase);
    productSalesMap.set(item.product_id, existing);
  });

  const topProductEntries = Array.from(productSalesMap.entries())
    .sort((a, b) => b[1].earnings - a[1].earnings)
    .slice(0, 5);

  const topProductIds = topProductEntries.map(([id]) => id);
  const { data: topProductsData } = await supabase
    .from("products")
    .select("id,name,price,stock_qty,images")
    .in("id", topProductIds);

  const productMap = new Map(
    (topProductsData ?? []).map((p) => [p.id, p]),
  );

  const topProducts = topProductEntries.map(([id, data]) => {
    const product = productMap.get(id);
    return {
      id,
      name: product?.name ?? "Unknown",
      image: product?.images?.[0] ?? null,
      stocks: product?.stock_qty ?? 0,
      price: Number(product?.price ?? 0),
      sales: data.qty,
      earnings: data.earnings,
    };
  });

  // Recent activity
  const recentOrders = orders.slice(0, 5);
  const orderUserIds = Array.from(
    new Set(recentOrders.map((o) => o.user_id).filter(Boolean) as string[]),
  );
  const { data: orderUsers } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", orderUserIds);

  const userEmailMap = new Map(
    (orderUsers ?? []).map((u) => [u.id, u.email]),
  );

  const { data: lowStockProducts } = await supabase
    .from("products")
    .select("name,stock_qty")
    .lt("stock_qty", 5)
    .eq("is_active", true)
    .limit(3);

  const activity: DashboardActivity[] = [];

  recentOrders.forEach((order) => {
    const email = userEmailMap.get(order.user_id) ?? "a customer";
    activity.push({
      type: "new_order",
      title: "New order placed",
      subtitle: `Order #${order.order_number ?? order.id.slice(0, 8)} by ${email}`,
      time: timeAgo(order.created_at),
      badge: { label: "New Order", color: "bg-emerald-500/10 text-emerald-600" },
    });
  });

  (lowStockProducts ?? []).forEach((p) => {
    activity.push({
      type: "low_stock",
      title: "Low stock alert",
      subtitle: `${p.name} has only ${p.stock_qty} units left`,
      time: "Today",
      badge: { label: "Low Stock", color: "bg-red-500/10 text-red-600" },
    });
  });

  (recentUsers ?? []).slice(0, 3).forEach((u) => {
    activity.push({
      type: "new_user",
      title: "New customer registered",
      subtitle: `${u.email ?? "Someone"} created an account`,
      time: timeAgo(u.created_at),
      badge: { label: "New User", color: "bg-violet-500/10 text-violet-600" },
    });
  });

  activity.sort((a, b) => {
    const orderMap: Record<string, number> = { new_order: 0, payment: 1, low_stock: 2, new_user: 3 };
    return orderMap[a.type] - orderMap[b.type];
  });

  return {
    totalProducts: totalProducts ?? 0,
    totalOrders,
    totalRevenue,
    lowStockCount: lowStockCount ?? 0,
    revenueByMonth,
    categories,
    recentActivity: activity.slice(0, 8),
    topProducts,
  } satisfies DashboardData;
});
