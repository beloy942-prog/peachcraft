import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Search, MoreHorizontal, Plus, ArrowUpDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import type { ProductRow } from "@/lib/api/supabase.functions";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString("en-PH")}`;
}

function getStockBadge(stock: number | null | undefined) {
  const qty = stock ?? 0;
  if (qty > 20)
    return { label: String(qty), className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" };
  if (qty >= 5)
    return { label: String(qty), className: "bg-amber-100 text-amber-700 hover:bg-amber-100" };
  return { label: String(qty), className: "bg-red-100 text-red-700 hover:bg-red-100" };
}

type SortOption = "newest" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";

type Props = {
  data: ProductRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
  activeId: string | null;
  onToggle: (product: ProductRow) => void;
  onDelete: (product: ProductRow) => void;
};

function ProductsTable({ data, isLoading, error, activeId, onToggle, onDelete }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.map((p) => p.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q) ||
          (p.tag ?? "").toLowerCase().includes(q),
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (statusFilter === "active") {
      result = result.filter((p) => p.is_active);
    } else if (statusFilter === "disabled") {
      result = result.filter((p) => !p.is_active);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "stock_asc":
          return (a.stock_qty ?? 0) - (b.stock_qty ?? 0);
        case "stock_desc":
          return (b.stock_qty ?? 0) - (a.stock_qty ?? 0);
        case "newest":
        default:
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
    });

    return result;
  }, [data, searchQuery, categoryFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (safePage !== page) {
    setPage(safePage);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-md animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Could not load products."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Page header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Products</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">Manage products</h1>
        </div>
        <Link to="/admin/products/new">
          <Button className="w-full sm:w-auto rounded-full bg-[#4a7c59] hover:bg-[#3d6a4a] text-white gap-2">
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </Link>
      </div>

      <div className="border-t border-gray-200" />

      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-32 lg:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-28 lg:w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as SortOption);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-28 lg:w-32">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-gray-400" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
              <SelectItem value="stock_asc">Stock ↑</SelectItem>
              <SelectItem value="stock_desc">Stock ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Table card ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No products found</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">Try adjusting your search or filters</p>
            <Link to="/admin/products/new">
              <Button className="rounded-full bg-[#4a7c59] hover:bg-[#3d6a4a] text-white gap-2">
                <Plus className="h-4 w-4" />
                Add product
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="flex flex-col gap-3 p-3 sm:hidden">
              {paginated.map((product) => {
                const stock = getStockBadge(product.stock_qty);
                return (
                  <div key={product.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <Avatar className="h-11 w-11 rounded-xl shrink-0">
                          <AvatarImage src={product.images[0]} alt={product.name} className="object-cover" />
                          <AvatarFallback className="rounded-xl">{getInitials(product.name)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <Avatar className="h-11 w-11 rounded-xl shrink-0">
                          <AvatarFallback className="rounded-xl bg-gray-100 text-gray-500 text-xs">{getInitials(product.name)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm font-medium text-gray-700">{formatPrice(product.price)}</span>
                          {product.category && (
                            <Badge variant="outline" className="text-gray-500 border-gray-200 font-normal text-xs">{product.category}</Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem asChild>
                            <Link to="/admin/products/$id" params={{ id: product.id }} className="cursor-pointer">Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggle(product)} disabled={activeId === product.id} className="cursor-pointer">
                            {product.is_active ? "Disable" : "Enable"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(product)} disabled={activeId === product.id} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Badge className={stock.className} variant="secondary">{stock.label} in stock</Badge>
                      </div>
                      <Switch
                        checked={!!product.is_active}
                        onCheckedChange={() => onToggle(product)}
                        disabled={activeId === product.id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                    Product
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                    Price
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                    Category
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                    Stock
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                    Active
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4 text-right">
                    Total Sold
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((product) => {
                  const stock = getStockBadge(product.stock_qty);
                  return (
                    <TableRow key={product.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      {/* Product */}
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <Avatar className="h-10 w-10 rounded-full">
                              <AvatarImage src={product.images[0]} alt={product.name} className="object-cover" />
                              <AvatarFallback className="rounded-full">{getInitials(product.name)}</AvatarFallback>
                            </Avatar>
                          ) : (
                            <Avatar className="h-10 w-10 rounded-full">
                              <AvatarFallback className="rounded-full bg-gray-100 text-gray-500 text-xs">
                                {getInitials(product.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium text-sm text-gray-900">{product.name}</span>
                        </div>
                      </TableCell>

                      {/* Price */}
                      <TableCell className="px-4 py-3 text-gray-700 tabular-nums text-sm">
                        {formatPrice(product.price)}
                      </TableCell>

                      {/* Category */}
                      <TableCell className="px-4 py-3">
                        {product.category ? (
                          <Badge variant="outline" className="text-gray-500 border-gray-200 font-normal text-xs">
                            {product.category}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>

                      {/* Stock */}
                      <TableCell className="px-4 py-3">
                        <Badge className={stock.className} variant="secondary">
                          {stock.label}
                        </Badge>
                      </TableCell>

                      {/* Active */}
                      <TableCell className="px-4 py-3">
                        <Switch
                          checked={!!product.is_active}
                          onCheckedChange={() => onToggle(product)}
                          disabled={activeId === product.id}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem asChild>
                              <Link
                                to="/admin/products/$id"
                                params={{ id: product.id }}
                                className="cursor-pointer"
                              >
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onToggle(product)}
                              disabled={activeId === product.id}
                              className="cursor-pointer"
                            >
                              {product.is_active ? "Disable" : "Enable"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete(product)}
                              disabled={activeId === product.id}
                              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>

            {/* ─── Table footer ──────────────────────────────────────── */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                {" "}of{" "}
                {Math.min(safePage * pageSize, filtered.length)}
                {" "}of {filtered.length} products
              </p>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.max(1, safePage - 1));
                      }}
                      className={safePage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - safePage) <= 1) return true;
                      return false;
                    })
                    .map((p, idx, arr) => {
                      const nodes = [];
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        nodes.push(
                          <PaginationItem key={`ellipsis-${p}`}>
                            <span className="flex h-9 w-9 items-center justify-center text-sm text-gray-400">...</span>
                          </PaginationItem>,
                        );
                      }
                      nodes.push(
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === safePage}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(p);
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>,
                      );
                      return nodes;
                    })
                    .flat()}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.min(totalPages, safePage + 1));
                      }}
                      className={safePage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { ProductsTable };
