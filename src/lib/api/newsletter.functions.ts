import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyAdmin } from "./admin-auth";

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  created_at: string;
};

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email("Please enter a valid email address.").max(254),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    // Normalize so the unique constraint catches case variants of the same address.
    const email = data.email.trim().toLowerCase();

    const { error } = await supabase.from("newsletter_subscribers").insert({ email });

    if (error) {
      if (error.code === "23505") {
        return { success: true, alreadySubscribed: true, message: "You're already subscribed! 🍑" };
      }
      console.error("[subscribeNewsletter] insert failed:", error.message);
      throw new Error("Unable to subscribe right now. Please try again.");
    }

    return { success: true, alreadySubscribed: false, message: "You're in! Watch your inbox for fresh crafts. 🍑" };
  });

export const getNewsletterSubscribers = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getNewsletterSubscribers] query failed:", error.message);
    throw new Error("Unable to load newsletter subscribers.");
  }

  return (data ?? []) as NewsletterSubscriberRow[];
});
