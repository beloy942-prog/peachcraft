import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyAdmin } from "./admin-auth";

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().trim().min(1, "Please enter your name.").max(100),
      email: z.string().email("Please enter a valid email address.").max(254),
      message: z.string().trim().min(1, "Please enter a message.").max(2000),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();

    const { error } = await supabase.from("contact_messages").insert({
      name: data.name,
      email: data.email.toLowerCase(),
      message: data.message,
      status: "new",
    });

    if (error) {
      console.error("[submitContactMessage] insert failed:", error.message);
      throw new Error("Unable to send your message right now. Please try again.");
    }

    return { success: true, message: "Message sent! We'll reply within 1-2 business days. 🍑" };
  });

export const getContactMessages = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, message, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getContactMessages] query failed:", error.message);
    throw new Error("Unable to load contact messages.");
  }

  return (data ?? []) as ContactMessageRow[];
});

export const updateContactMessageStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "read"]),
    }),
  )
  .handler(async ({ data }) => {
    await verifyAdmin();
    const supabase = getSupabaseServer();

    // Idempotent: setting an already-set status is a no-op success.
    const { error } = await supabase
      .from("contact_messages")
      .update({ status: data.status })
      .eq("id", data.id);

    if (error) {
      console.error("[updateContactMessageStatus] update failed:", error.message);
      throw new Error("Unable to update the message status.");
    }

    return { success: true };
  });
