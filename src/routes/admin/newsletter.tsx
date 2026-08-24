import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getNewsletterSubscribers, type NewsletterSubscriberRow } from "@/lib/api/newsletter.functions";

export const Route = createFileRoute("/admin/newsletter")({
  component: AdminNewsletterPage,
});

const pageSize = 25;

function AdminNewsletterPage() {
  const { data, isLoading, error } = useQuery<NewsletterSubscriberRow[]>({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: getNewsletterSubscribers,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = data
    ? data.filter((s) => (searchQuery.trim() ? s.email.toLowerCase().includes(searchQuery.trim().toLowerCase()) : true))
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-6">
      {/* ─── Page header ──────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">Newsletter</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Newsletter subscribers</h1>
        {!isLoading && !error ? (
          <p className="mt-1 text-sm text-gray-500">{filtered.length} subscriber{filtered.length === 1 ? "" : "s"}</p>
        ) : null}
      </div>

      <div className="border-t border-gray-200" />

      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* ─── Loading state ────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Could not load subscribers."}</p>
        </div>
      ) : (
        /* ─── Table card ────────────────────────────────────── */
        <div className="bg-white rounded-xl shadow-sm border">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No subscribers found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery ? "Try adjusting your search" : "Signups from the footer will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        Email
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        Joined
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((subscriber) => (
                      <TableRow key={subscriber.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                        <TableCell className="px-4 py-3 text-sm font-medium text-gray-900">
                          {subscriber.email}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-500">
                          {subscriber.created_at ? format(new Date(subscriber.created_at), "MMM d, yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* ─── Table footer ──────────────────────────────── */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                  {" "}to{" "}
                  {Math.min(safePage * pageSize, filtered.length)}
                  {" "}of {filtered.length} subscribers
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
