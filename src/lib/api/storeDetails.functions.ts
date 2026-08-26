import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer } from "../supabase";
import { verifyAdmin, validateImageBuffer } from "./admin-auth";

export type StoreDetails = {
  store_name: string;
  store_logo: string | null;
  store_description: string | null;
  contact_email: string | null;
  contact_number: string;
  address: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  footer_text: string | null;
  hero_banner: string | null;
  gcash_number: string | null;
  gcash_account_name: string | null;
  gcash_qr: string | null;
};

export const uploadStoreImage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fileName: z.string().min(1),
      base64: z.string().min(1),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);

    const { Buffer } = await import("node:buffer");
    const mimeType = data.base64.match(/^data:(.*);base64,/)?.[1] ?? "application/octet-stream";
    const base64String = data.base64.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64String, "base64");

    validateImageBuffer(buffer);

    const filePath = `public/${Date.now()}-${data.fileName}`;

    const encodeR2ObjectKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

    const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const r2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const r2ApiToken = process.env.CLOUDFLARE_R2_API_TOKEN;

    if (!r2AccountId || !r2BucketName || !r2ApiToken) {
      throw new Error("Cloudflare R2 is not configured for image uploads.");
    }

    const encodedObjectKey = encodeR2ObjectKey(filePath);
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${r2AccountId}/r2/buckets/${r2BucketName}/objects/${encodedObjectKey}`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${r2ApiToken}`,
        "Content-Type": mimeType,
      },
      body: buffer,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || json?.success === false) {
      const message = json?.errors?.[0]?.message ?? `Cloudflare R2 upload failed with status ${response.status}`;
      throw new Error(message);
    }

    return { publicUrl: `/api/images/${encodeURIComponent(filePath)}` };
  });

export const getStoreDetails = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from("website_settings").select("*").maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  });

export const updateStoreDetails = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      store_name: z.string().min(1),
      store_logo: z.string().nullable(),
      store_description: z.string().nullable(),
      contact_email: z.string().nullable(),
      contact_number: z.string().min(1),
      address: z.string().nullable(),
      tiktok_url: z.string().nullable(),
      instagram_url: z.string().nullable(),
      footer_text: z.string().nullable(),
      hero_banner: z.string().nullable(),
      gcash_number: z.string().nullable(),
      gcash_account_name: z.string().nullable(),
      gcash_qr: z.string().nullable(),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);
    const supabase = getSupabaseServer();

    const payload = {
      id: "singleton",
      store_name: data.store_name,
      store_logo: data.store_logo,
      store_description: data.store_description,
      contact_email: data.contact_email,
      contact_number: data.contact_number,
      address: data.address,
      tiktok_url: data.tiktok_url,
      instagram_url: data.instagram_url,
      footer_text: data.footer_text,
      hero_banner: data.hero_banner,
      gcash_number: data.gcash_number,
      gcash_account_name: data.gcash_account_name,
      gcash_qr: data.gcash_qr,
    };

    const { error } = await supabase.from("website_settings").upsert(payload, { onConflict: "id" });

    if (error) {
      throw error;
    }

    return { id: "singleton" };
  });
