import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox, Search, ChevronLeft, ChevronRight, MailOpen } from "lucide-react";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  getContactMessages,
  updateContactMessageStatus,
  type ContactMessageRow,
} from "@/lib/api/contact.functions";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessagesPage,
});

const pageSize = 25;

function AdminMessagesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<ContactMessageRow[]>({
    queryKey: ["admin-contact-messages"],
    queryFn: getContactMessages,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const markRead = useMutation({
    mutationFn: (id: string) => updateContactMessageStatus({ data: { id, status: "read" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
    },
    onError: (err) => {
      // Surfaced per-row; list stays usable.
      console.error(err);
    },
  });

  const filtered = data
    ? data.filter((m) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q)
        );
      })
    : [];

  const newCount = data?.filter((m) => m.status === "new").length ?? 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-6">
      {/* ─── Page header ──────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">Messages</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Contact messages</h1>
        {!isLoading && !error ? (
          <p className="mt-1 text-sm text-gray-500">
            {filtered.length} message{filtered.length === 1 ? "" : "s"}
            {newCount > 0 ? ` · ${newCount} new` : ""}
          </p>
        ) : null}
      </div>

      <div className="border-t border-gray-200" />

      {/* ─── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, email, or message..."
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
          <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Could not load messages."}</p>
        </div>
      ) : (
        /* ─── Table card ────────────────────────────────────── */
        <div className="bg-white rounded-xl shadow-sm border">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Inbox className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No messages found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery ? "Try adjusting your search" : "Contact form submissions will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        From
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        Message
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        Status
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        Received
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-gray-500 font-semibold h-10 px-4">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((msg) => (
                      <TableRow
                        key={msg.id}
                        className={`transition-colors border-b border-gray-100 ${msg.status === "new" ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-gray-50"}`}
                      >
                        <TableCell className="px-4 py-3 align-top">
                          <p className={`text-sm ${msg.status === "new" ? "font-semibold text-gray-900" : "font-medium text-gray-900"}`}>
                            {msg.name}
                          </p>
                          <p className="text-xs text-gray-500">{msg.email}</p>
                        </TableCell>

                        <TableCell className="px-4 py-3 align-top max-w-md">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{msg.message}</p>
                        </TableCell>

                        <TableCell className="px-4 py-3 align-top">
                          {msg.status === "new" ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              New
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                              Read
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="px-4 py-3 align-top text-sm text-gray-500 whitespace-nowrap">
                          {msg.created_at ? format(new Date(msg.created_at), "MMM d, yyyy h:mm a") : "—"}
                        </TableCell>

                        <TableCell className="px-4 py-3 align-top">
                          {msg.status === "new" ? (
                            <button
                              type="button"
                              onClick={() => markRead.mutate(msg.id)}
                              disabled={markRead.isPending}
                              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                            >
                              <MailOpen className="h-3.5 w-3.5" />
                              {markRead.isPending && markRead.variables === msg.id ? "Marking..." : "Mark as read"}
                            </button>
                          ) : null}
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
                  {" "}of {filtered.length} messages
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
