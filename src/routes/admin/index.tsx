import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDashboardData, type DashboardData } from "@/lib/api/dashboard.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const CATEGORY_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#e879f9", "#f472b6", "#fb7185", "#f87171"];

const statCardConfig = [
  { label: "Total Products", icon: Package, color: "bg-violet-500", key: "totalProducts" as const, format: (v: number) => v.toLocaleString() },
  { label: "Total Orders", icon: ShoppingCart, color: "bg-blue-500", key: "totalOrders" as const, format: (v: number) => v.toLocaleString() },
  { label: "Total Revenue", icon: DollarSign, color: "bg-emerald-500", key: "totalRevenue" as const, format: (v: number) => `₱${v.toLocaleString()}` },
  { label: "Low Stock Items", icon: Package, color: "bg-orange-500", key: "lowStockCount" as const, format: (v: number) => v.toLocaleString() },
];

type SortKey = "name" | "stocks" | "price" | "sales" | "earnings";

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-lg bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
      <div className="mt-4 h-8 w-28 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-20 rounded bg-gray-200" />
    </div>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-white p-5 shadow-sm animate-pulse", className)}>
      <div className="h-5 w-36 rounded bg-gray-200 mb-2" />
      <div className="h-4 w-48 rounded bg-gray-200 mb-6" />
      <div className="h-[200px] rounded bg-gray-100" />
    </div>
  );
}

function AdminDashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: getDashboardData,
  });

  const [sortKey, setSortKey] = useState<SortKey>("sales");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedProducts = data
    ? [...data.topProducts].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      })
    : [];

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <div className="h-7 w-36 rounded bg-gray-200 animate-pulse" />
          <div className="mt-1 h-4 w-56 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-5">
          <ChartSkeleton className="xl:col-span-3" />
          <ChartSkeleton className="xl:col-span-2" />
        </div>
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-5">
          <ChartSkeleton className="xl:col-span-2 h-[320px]" />
          <ChartSkeleton className="xl:col-span-3 h-[320px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-red-50 p-6">
        <p className="text-sm font-medium text-red-800">Failed to load dashboard data</p>
        <p className="mt-1 text-xs text-red-600">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  const chartData = data!.revenueByMonth.map((d) => ({
    name: d.month.slice(5),
    revenue: d.revenue,
  }));

  const totalCatCount = data!.categories.reduce((sum, c) => sum + c.count, 0);

  const activityIcons: Record<string, typeof ShoppingCart> = {
    new_order: ShoppingCart,
    low_stock: Package,
    new_user: Users,
    payment: TrendingUp,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Your store overview at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCardConfig.map((cfg) => {
          const value = data![cfg.key];
          return (
            <div key={cfg.label} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", cfg.color)}>
                  <cfg.icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-gray-900">{cfg.format(value)}</p>
              <p className="mt-1 text-sm text-gray-500">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-5">
        {/* Sales Revenue Bar Chart */}
        <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">Sales Revenue</h2>
              <p className="text-xs text-gray-500">Monthly revenue (last 12 months)</p>
            </div>
          </div>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`₱${value.toLocaleString()}`, "Revenue"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="#6366f1" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Categories Donut Chart */}
        <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm xl:col-span-2">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Product Categories</h2>
          <p className="text-xs text-gray-500 mb-4">Category distribution</p>
          <div className="flex h-[180px] sm:h-[200px] items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data!.categories.map((c, i) => ({ ...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="name"
                >
                  {data!.categories.map((entry, i) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}`, "Products"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {data!.categories.map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-gray-600">{cat.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{cat.count}</span>
                  <span className="text-xs text-gray-400">
                    ({totalCatCount > 0 ? ((cat.count / totalCatCount) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-5">
        {/* Recent Activity */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5 shadow-sm xl:col-span-2">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Recent Activity</h2>
          <p className="text-xs text-gray-500 mb-4">Latest store events</p>
          {data!.recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {data!.recentActivity.map((activity, i) => {
                const Icon = activityIcons[activity.type] ?? ShoppingCart;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 rounded-full border-0 px-2 py-0 text-[10px] font-medium",
                            activity.badge.color,
                          )}
                        >
                          {activity.badge.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{activity.subtitle}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Products Table */}
        <div className="min-w-0 rounded-xl border bg-white p-4 sm:p-5 shadow-sm xl:col-span-3">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Top Products</h2>
          <p className="text-xs text-gray-500 mb-4">Best selling products by revenue</p>
          {data!.topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">No product sales data yet</p>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Product</TableHead>
                  {(["stocks", "price", "sales", "earnings"] as const).map((key) => (
                    <TableHead
                      key={key}
                      className="cursor-pointer hover:text-gray-900"
                      onClick={() => toggleSort(key)}
                    >
                      <div className="flex items-center gap-1">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                        {sortKey === key && (
                          <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-9 w-9 rounded-md object-cover bg-gray-100"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-400 text-xs">
                            N/A
                          </div>
                        )}
                        <span className="font-medium text-gray-900 truncate max-w-[100px] lg:max-w-[200px]">
                          {product.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{product.stocks}</TableCell>
                    <TableCell className="text-gray-600">₱{product.price.toLocaleString()}</TableCell>
                    <TableCell className="text-gray-600">{product.sales}</TableCell>
                    <TableCell className="font-medium text-gray-900">
                      ₱{product.earnings.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
