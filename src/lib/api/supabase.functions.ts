import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer } from "../supabase";
import { verifyAdmin, validateImageBuffer } from "./admin-auth";
import { verifyTurnstile } from "./turnstile";

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  images?: string[] | null;
  tag?: string | null;
  swatch?: string | null;
  category?: string | null;
  stock_qty?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  materials?: string | null;
  dimensions?: string | null;
  care_instructions?: string | null;
  return_policy?: string | null;
};

export type ProductFormData = {
  name: string;
  price: number;
  description: string;
  category: string;
  tag: string;
  swatch: string;
  stock_qty: number;
  is_active: boolean;
  images: string[];
  materials: string;
  dimensions: string;
  care_instructions: string;
  return_policy: string;
};

export type OrderSummary = {
  id: string;
  order_number: string | null;
  user_email: string;
  total_amount: number;
  status: string;
  created_at: string;
};

export type OrderDetailItem = {
  id: string;
  product_name: string;
  product_image: string | null;
  qty: number;
  price_at_purchase: number;
};

export type OrderDetail = {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  shipping_address: {
    street?: string;
    city?: string;
    province?: string;
    zip?: string;
  } | null;
  customer: {
    name?: string | null;
    email?: string | null;
  };
  items: OrderDetailItem[];
};

export type CartOrderItem = {
  product_id: string;
  qty: number;
  price_at_purchase: number;
};

export type OrderShippingAddress = {
  name: string;
  email: string;
  street: string;
  city: string;
  province: string;
  zip: string;
};

export type CreateOrderInput = {
  items: CartOrderItem[];
  shipping_address: OrderShippingAddress;
  total_amount: number;
  payment_method: "cash_on_delivery" | "gcash";
};

export type GCashPaymentRow = {
  id: string;
  order_id: string;
  gcash_reference_number: string;
  screenshot_url: string | null;
  customer_email: string;
  submitted_at: string;
  verified_at: string | null;
  status: string;
};

export type SubmitGCashProofInput = {
  order_id: string;
  gcash_reference_number: string;
  screenshot_url: string;
  customer_email: string;
};

export type AdminDashboardData = {
  todaysRevenue: number;
  todaysOrders: number;
  pendingOrders: number;
  lowStock: Array<{ id: string; name: string; stock_qty: number | null }>;
  recentOrders: OrderSummary[];
};

function formatDateRange(start: Date, end: Date) {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export const getFeaturedProducts = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,description,images,tag,swatch,category,stock_qty,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(4);

  if (error) {
    throw error;
  }

  return data ?? [];
});

export const getAllProducts = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,description,images,tag,swatch,category,stock_qty,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
});

export const getAdminDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [{ data: todaysOrdersData, error: todaysOrdersError }, { data: todaysRevenueData, error: todaysRevenueError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact" })
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
    supabase
      .from("orders")
      .select("total_amount")
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
  ]);

  if (todaysOrdersError) {
    throw todaysOrdersError;
  }
  if (todaysRevenueError) {
    throw todaysRevenueError;
  }

  const todaysOrders = todaysOrdersData?.length ?? 0;
  const todaysRevenue = (todaysRevenueData ?? []).reduce((sum, item) => sum + item.total_amount, 0);

  const { data: pendingOrdersData, error: pendingOrdersError } = await supabase
    .from("orders")
    .select("id", { count: "exact" })
    .eq("status", "pending");

  if (pendingOrdersError) {
    throw pendingOrdersError;
  }

  const pendingOrders = pendingOrdersData?.length ?? 0;

  const { data: lowStock, error: lowStockError } = await supabase
    .from("products")
    .select("id,name,stock_qty")
    .lt("stock_qty", 5)
    .order("stock_qty", { ascending: true });

  if (lowStockError) {
    throw lowStockError;
  }


  const { data: recentOrders, error: recentOrdersError } = await supabase
    .from("orders")
    .select("id,order_number,user_id,total_amount,status,created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentOrdersError) {
    throw recentOrdersError;
  }

  const userIds = Array.from(new Set((recentOrders ?? []).map((order) => order.user_id).filter(Boolean)));
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", userIds);

  if (profileError) {
    throw profileError;
  }

  const userMap = new Map(profileRows?.map((user) => [user.id, user.email]));
  return {
    todaysRevenue,
    todaysOrders,
    pendingOrders,
    lowStock: (lowStock ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      stock_qty: product.stock_qty,
    })),
    recentOrders: (recentOrders ?? []).map((order) => ({
      id: order.id,
      order_number: order.order_number ?? null,
      user_email: userMap.get(order.user_id) ?? "Unknown",
      total_amount: order.total_amount,
      status: order.status,
      created_at: order.created_at,
    })),
  };
});

export type AdminNotification = {
  id: string;
  type: "new_order" | "pending_order" | "low_stock";
  title: string;
  subtitle: string;
  link: string;
  created_at: string;
};

export type AdminNotificationsResponse = {
  totalCount: number;
  newOrdersToday: number;
  pendingOrders: number;
  lowStockCount: number;
  notifications: AdminNotification[];
};

export const getAdminNotifications = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [{ count: todaysOrders }, { count: pendingOrders }, { data: lowStockItems }] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString()),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("products")
      .select("id,name,stock_qty")
      .lt("stock_qty", 5)
      .order("stock_qty", { ascending: true })
      .limit(10),
  ]);

  const lowStockCount = lowStockItems?.length ?? 0;
  const notifications: AdminNotification[] = [];

  if (pendingOrders && pendingOrders > 0) {
    const { data: recentPending } = await supabase
      .from("orders")
      .select("id,order_number,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    for (const order of recentPending ?? []) {
      notifications.push({
        id: `pending-${order.id}`,
        type: "pending_order",
        title: "Pending order",
        subtitle: `Order #${order.order_number ?? order.id.slice(0, 8)} awaiting processing`,
        link: `/admin/orders/${order.id}`,
        created_at: order.created_at,
      });
    }
  }

  for (const item of lowStockItems ?? []) {
    notifications.push({
      id: `stock-${item.id}`,
      type: "low_stock",
      title: "Low stock alert",
      subtitle: `${item.name} — only ${item.stock_qty} left`,
      link: "/admin/products",
      created_at: new Date().toISOString(),
    });
  }

  notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalCount = (todaysOrders ?? 0) + (pendingOrders ?? 0) + lowStockCount;

  return {
    totalCount,
    newOrdersToday: todaysOrders ?? 0,
    pendingOrders: pendingOrders ?? 0,
    lowStockCount,
    notifications: notifications.slice(0, 20),
  } satisfies AdminNotificationsResponse;
});

export const getUserActiveOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        return { hasActiveOrder: false, activeOrder: null };
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) {
      return { hasActiveOrder: false, activeOrder: null };
    }

    const supabase = getSupabaseServer();
    const { data: activeOrders, error } = await supabase
      .from("orders")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed", "shipped"]);

    if (error) {
      throw error;
    }

    return {
      hasActiveOrder: activeOrders && activeOrders.length > 0,
      activeOrder: activeOrders?.[0] ?? null,
    };
  });

async function restoreStock(supabase: ReturnType<typeof getSupabaseServer>, productId: string, qty: number) {
  if (qty <= 0) return;
  const { data: p } = await supabase.from("products").select("stock_qty").eq("id", productId).single();
  if (p) {
    await supabase.from("products").update({ stock_qty: (p.stock_qty ?? 0) + qty }).eq("id", productId);
  }
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      items: z.array(
        z.object({
          product_id: z.string().uuid(),
          qty: z.number().min(1),
          price_at_purchase: z.number().min(0),
        }),
      ).min(1),
      shipping_address: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        street: z.string().min(1),
        city: z.string().min(1),
        province: z.string().min(1),
        zip: z.string().min(1),
      }),
      total_amount: z.number().min(0),
      payment_method: z.enum(["cash_on_delivery", "gcash"]),
      accessToken: z.string().optional(),
      turnstileToken: z.string().optional(),
      ip: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // --- Determine if this is a guest or authenticated order ---
    const isGuest = !data.accessToken;

    const supabase = getSupabaseServer();

    // --- Auth path: validate token, check email verification, active order ---
    let userId: string | null = null;
    if (!isGuest) {
      const authClient = getSupabaseServer(undefined, { authOnly: true });
      const tokenResult = await authClient.auth.getUser(data.accessToken!);
      if (tokenResult.error) {
        throw new Error("Authentication required. Please sign in to place an order.");
      }
      userId = tokenResult.data?.user?.id ?? null;
      if (!userId) {
        throw new Error("Authentication required. Please sign in to place an order.");
      }

      // Verify email_verified status in user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email_verified")
        .eq("id", userId)
        .single();

      if (profileError || !profile || !profile.email_verified) {
        throw new Error("Your email has not been verified yet. Please verify your email before placing an order.");
      }

      // Active order check: skip for guests — no stable identity to key on
      const { data: activeOrders, error: activeOrdersError } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "confirmed", "shipped"]);

      if (activeOrdersError) {
        throw activeOrdersError;
      }

      if (activeOrders && activeOrders.length > 0) {
        throw new Error("You already have an active order. You can only place a new order once your current order is completed or cancelled.");
      }
    }

    // --- Product validation (shared for both paths) ---
    const productIds = Array.from(new Set(data.items.map((item) => item.product_id)));
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,name,price,stock_qty,is_active")
      .in("id", productIds);

    if (productsError) {
      throw productsError;
    }

    const productMap = new Map(products?.map((product) => [product.id, product]));

    for (const item of data.items) {
      const product = productMap.get(item.product_id);
      if (!product || !product.is_active) {
        throw new Error("One or more products are unavailable.");
      }
      const available = product.stock_qty ?? 0;
      if (item.qty > available) {
        throw new Error(`Not enough stock for ${product.name}.`);
      }
      if (Math.round(item.price_at_purchase * 100) !== Math.round(product.price * 100)) {
        throw new Error(`Pricing mismatch for ${product.name}. Please refresh your cart.`);
      }
    }

    // --- Stock reservation with rollback ---
    const updatedProductIds: string[] = [];
    const deducted = new Map<string, number>();

    for (const item of data.items) {
      const product = productMap.get(item.product_id)!;

      const { data: current } = await supabase
        .from("products")
        .select("stock_qty")
        .eq("id", item.product_id)
        .single();

      const currentStock = current?.stock_qty ?? 0;
      if (item.qty > currentStock) {
        for (const rollbackId of updatedProductIds) {
          await restoreStock(supabase, rollbackId, deducted.get(rollbackId) ?? 0);
        }
        throw new Error(`Not enough stock for ${product.name}.`);
      }

      const { data: updated, error: updateError } = await supabase
        .from("products")
        .update({ stock_qty: currentStock - item.qty })
        .eq("id", item.product_id)
        .gte("stock_qty", item.qty)
        .select("id");

      if (updateError || !updated || updated.length === 0) {
        for (const rollbackId of updatedProductIds) {
          await restoreStock(supabase, rollbackId, deducted.get(rollbackId) ?? 0);
        }
        throw new Error(`Failed to reserve stock for ${product.name}. Please try again.`);
      }

      updatedProductIds.push(item.product_id);
      deducted.set(item.product_id, (deducted.get(item.product_id) ?? 0) + item.qty);
    }

    // --- Create order ---
    // Total is recomputed from server-verified prices (each item's
    // price_at_purchase was already matched against products.price above),
    // so a tampered client-side total_amount can never be persisted.
    // Shipping/tax mirror the constants shown in checkout.tsx so the stored
    // amount always matches what the customer was charged.
    const SHIPPING_FEE = 150;
    const TAX_AMOUNT = 0;
    const serverTotal = Math.round(
      (data.items.reduce((sum, item) => sum + item.price_at_purchase * item.qty, 0) +
        SHIPPING_FEE +
        TAX_AMOUNT) * 100,
    ) / 100;

    const orderPayload: Record<string, unknown> = {
      user_id: userId, // NULL for guest orders
      total_amount: serverTotal,
      status: "pending",
      shipping_address: data.shipping_address,
      payment_method: data.payment_method,
      payment_status: data.payment_method === "gcash" ? "pending" : "paid",
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError || !order) {
      for (const rollbackId of updatedProductIds) {
        await restoreStock(supabase, rollbackId, deducted.get(rollbackId) ?? 0);
      }
      throw orderError ?? new Error("Failed to create order.");
    }

    // Generate human-readable order_number (PCH-YYYYMMDD-XXX) and persist it
    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from("orders")
      .update({ order_number: generateOrderId(order.id, new Date().toISOString()) })
      .eq("id", order.id)
      .select("order_number")
      .single();

    if (updateOrderError || !updatedOrder) {
      // Non-fatal: order was created, but order_number failed to persist.
      // Fall back to client-computed value for now.
      console.error("Failed to persist order_number:", updateOrderError);
    }

    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      qty: item.qty,
      price_at_purchase: item.price_at_purchase,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) {
      for (const rollbackId of updatedProductIds) {
        await restoreStock(supabase, rollbackId, deducted.get(rollbackId) ?? 0);
      }
      throw itemsError;
    }

    return { id: order.id, order_number: updatedOrder?.order_number ?? null };
  });

function generateOrderId(orderUuid: string, createdAt: string): string {
  const date = new Date(createdAt);
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = orderUuid.replace(/-/g, "").slice(0, 3).toUpperCase();
  return `PCH-${yyyymmdd}-${suffix}`;
}

const KNOWN_IMAGE_MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/gif": [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
};

function validateMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  const signatures = KNOWN_IMAGE_MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) return false;
    }
    return true;
  });
}

export const uploadPaymentProof = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fileName: z.string().min(1),
      base64: z.string().min(1),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // File upload is available to both authenticated and guest users.
    // Ownership is verified later at submitGCashProof time, not here.
    const supabase = getSupabaseServer();

    const { Buffer } = await import("node:buffer");
    const mimeType = data.base64.match(/^data:(.*);base64,/)?.[1] ?? "application/octet-stream";
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType)) {
      throw new Error("Unsupported file type. Please upload a PNG, JPEG, GIF, or WebP image.");
    }

    const base64String = data.base64.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64String, "base64");

    if (!validateMagicBytes(new Uint8Array(buffer), mimeType)) {
      throw new Error("File validation failed. The uploaded file does not appear to be a valid image.");
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error("File is too large. Maximum size is 10 MB.");
    }

    const filePath = `payment-proofs/${Date.now()}-${data.fileName}`;
    const encodeR2ObjectKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

    const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const r2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const r2ApiToken = process.env.CLOUDFLARE_R2_API_TOKEN;

    if (r2AccountId && r2BucketName && r2ApiToken) {
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
      if (response.ok && json && json.success !== false) {
        const proxyUrl = `/api/images/${encodeURIComponent(filePath)}`;
        return { publicUrl: proxyUrl };
      }
      throw new Error(`R2 upload failed: ${json?.errors?.[0]?.message}`);
    }

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, buffer, { contentType: "image/*", upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicData } = await supabase.storage.from("payment-proofs").getPublicUrl(filePath);
    if (!publicData) throw new Error("Failed to generate public URL.");
    return { publicUrl: publicData.publicUrl };
  });

export const checkDuplicateReference = createServerFn({ method: "GET" })
  .inputValidator(z.object({ gcash_reference_number: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    const { data: existing } = await supabase
      .from("gcash_payments")
      .select("id, status")
      .eq("gcash_reference_number", data.gcash_reference_number)
      .maybeSingle();
    return {
      isDuplicate: existing !== null && existing.status !== "rejected",
      existingPayment: existing,
    };
  });

export const submitGCashProof = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      order_id: z.string().uuid(),
      gcash_reference_number: z.string().min(1, "GCash reference number is required."),
      screenshot_url: z.string().min(1),
      customer_email: z.string().email(),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();

    // --- Duplicate reference check (shared for both paths) ---
    const { data: existing } = await supabase
      .from("gcash_payments")
      .select("id, status")
      .eq("gcash_reference_number", data.gcash_reference_number)
      .maybeSingle();

    if (existing && existing.status !== "rejected") {
      throw new Error("This GCash reference number has already been used.");
    }

    // --- Fetch order ---
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, payment_method, payment_status, shipping_address")
      .eq("id", data.order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found.");
    }

    // --- Ownership verification ---
    // Authenticated path: verify order.user_id matches the session user.
    // Guest path: verify order.user_id IS NULL AND the email matches shipping_address.
    const isGuestOrder = order.user_id === null;

    if (isGuestOrder) {
      // Guest ownership: order must be unclaimed and email must match shipping address
      const shippingEmail = (order.shipping_address as Record<string, string>)?.email;
      if (!shippingEmail || shippingEmail.toLowerCase() !== data.customer_email.toLowerCase()) {
        throw new Error("Email does not match the order's shipping address.");
      }
    } else {
      // Authenticated ownership: verify via session token
      const authClient = getSupabaseServer(undefined, { authOnly: true });
      let userId: string | null = null;
      if (data.accessToken) {
        const tokenResult = await authClient.auth.getUser(data.accessToken);
        userId = tokenResult.data?.user?.id ?? null;
      }
      if (!userId) {
        throw new Error("Authentication required.");
      }
      if (order.user_id !== userId) {
        throw new Error("This order does not belong to you.");
      }
    }

    if (order.payment_method !== "gcash") {
      throw new Error("This order is not a GCash payment order.");
    }

    if (order.payment_status !== "pending") {
      throw new Error("Payment has already been submitted for this order.");
    }

    const { data: payment, error: insertError } = await supabase
      .from("gcash_payments")
      .insert({
        order_id: data.order_id,
        gcash_reference_number: data.gcash_reference_number,
        screenshot_url: data.screenshot_url,
        customer_email: data.customer_email,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error("This GCash reference number has already been used.");
      }
      throw insertError;
    }

    await supabase
      .from("orders")
      .update({ payment_status: "awaiting_verification" })
      .eq("id", data.order_id);

    return { id: payment.id, status: payment.status };
  });

export const verifyGCashPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      payment_id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    await verifyAdmin();

    const { data: payment, error: paymentError } = await supabase
      .from("gcash_payments")
      .select("id, order_id, status")
      .eq("id", data.payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error("GCash payment record not found.");
    }

    if (payment.status !== "pending") {
      throw new Error("This payment has already been processed.");
    }

    // Guard: if the order was cancelled after the proof was submitted,
    // reject the stale proof instead of resurrecting the cancelled order.
    if (data.action === "approve") {
      const { data: targetOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", payment.order_id)
        .single();

      if (targetOrder?.status === "cancelled") {
        const nowRejected = new Date().toISOString();
        await supabase
          .from("gcash_payments")
          .update({ status: "rejected", verified_at: nowRejected })
          .eq("id", data.payment_id);
        throw new Error("This order was already cancelled — its payment proof has been rejected.");
      }
    }

    const now = new Date().toISOString();

    const { error: updatePaymentError } = await supabase
      .from("gcash_payments")
      .update({
        status: data.action === "approve" ? "verified" : "rejected",
        verified_at: now,
      })
      .eq("id", data.payment_id);

    if (updatePaymentError) throw updatePaymentError;

    if (data.action === "approve") {
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", payment.order_id);

      if (updateOrderError) throw updateOrderError;
    } else {
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", payment.order_id);

      if (updateOrderError) throw updateOrderError;
    }

    return { success: true, action: data.action };
  });

export const getAdminPayments = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      status: z.enum(["pending", "verified", "rejected", "all"]).optional().default("all"),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    await verifyAdmin();

    let query = supabase
      .from("gcash_payments")
      .select(`
        id,
        order_id,
        gcash_reference_number,
        screenshot_url,
        customer_email,
        submitted_at,
        verified_at,
        status,
        orders!inner (
          total_amount,
          status,
          payment_status,
          shipping_address
        )
      `)
      .order("submitted_at", { ascending: false });

    if (data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: payments, error } = await query;
    if (error) throw error;

    return { payments: payments ?? [] };
  });

export const getAdminPaymentsPendingOrders = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseServer();
    await verifyAdmin();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id,order_number,total_amount,status,payment_status,shipping_address,created_at,user_id")
      .eq("payment_method", "gcash")
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { orders: orders ?? [] };
  });

export const getAdminPaymentSummary = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseServer();
    await verifyAdmin();

    const { count: needsReviewCount } = await supabase
      .from("gcash_payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: pendingOrdersCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("payment_method", "gcash")
      .eq("payment_status", "pending");

    const { count: verifiedCount } = await supabase
      .from("gcash_payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "verified");

    const { count: rejectedCount } = await supabase
      .from("gcash_payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    return {
      needsReviewCount: needsReviewCount ?? 0,
      pendingOrdersCount: pendingOrdersCount ?? 0,
      verifiedCount: verifiedCount ?? 0,
      rejectedCount: rejectedCount ?? 0,
    };
  });

export const getAdminPayment = createServerFn({ method: "GET" })
  .inputValidator(z.object({ payment_id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    await verifyAdmin();

    const { data: payment, error } = await supabase
      .from("gcash_payments")
      .select(`
        *,
        orders!inner (
          order_number,
          total_amount,
          status,
          payment_status,
          shipping_address,
          user_id,
          created_at
        )
      `)
      .eq("id", data.payment_id)
      .single();

    if (error || !payment) throw new Error("Payment record not found.");
    return payment;
  });

export const getAdminProducts = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,price,description,images,tag,swatch,category,stock_qty,is_active,created_at,materials,dimensions,care_instructions,return_policy",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
});

export const toggleProductActive = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), is_active: z.boolean(), accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);
    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from("products")
      .update({ is_active: data.is_active })
      .eq("id", data.id);

    if (error) {
      throw error;
    }

    return { id: data.id, is_active: data.is_active };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);
    const supabase = getSupabaseServer();

    // Fetch product to get images
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("images")
      .eq("id", data.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Delete images from storage
    if (product?.images && Array.isArray(product.images)) {
      const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
      const r2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
      const r2ApiToken = process.env.CLOUDFLARE_R2_API_TOKEN;
      const encodeR2ObjectKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
      const parseStorageFilePath = (imageUrl: string) => {
        if (imageUrl.startsWith("/api/images/")) {
          return decodeURIComponent(imageUrl.replace("/api/images/", ""));
        }

        if (imageUrl.includes("r2.cloudflarestorage.com") && r2BucketName) {
          try {
            const url = new URL(imageUrl);
            const bucketSegment = `/${r2BucketName}/`;
            const index = url.pathname.indexOf(bucketSegment);
            if (index >= 0) {
              return decodeURIComponent(url.pathname.slice(index + bucketSegment.length));
            }
          } catch {
            return null;
          }
        }

        if (imageUrl.includes("supabase.co")) {
          return imageUrl.split("/object/public/product-images/")[1] ?? null;
        }

        return null;
      };

      let deleteFailed = false;

      for (const imageUrl of product.images) {
        const filePath = parseStorageFilePath(imageUrl);

        if (filePath && r2AccountId && r2BucketName && r2ApiToken) {
          try {
            const encodedObjectKey = encodeR2ObjectKey(filePath);
            const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${r2AccountId}/r2/buckets/${r2BucketName}/objects/${encodedObjectKey}`;
            const response = await fetch(deleteUrl, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${r2ApiToken}`,
              },
            });

            if (response.ok) {
              console.log("[Delete] Removed Cloudflare R2 image:", filePath);
            } else {
              console.warn("[Delete] Failed to remove Cloudflare R2 image:", filePath, response.statusText);
              deleteFailed = true;
            }
          } catch (error) {
            console.warn("[Delete] Error removing Cloudflare R2 image:", filePath, error);
            deleteFailed = true;
          }
        } else if (imageUrl.includes("supabase.co")) {
          const supabaseFilePath = imageUrl.split("/object/public/product-images/")[1];
          if (supabaseFilePath) {
            try {
              const { error: removeError } = await supabase.storage.from("product-images").remove([supabaseFilePath]);
              if (removeError) {
                console.warn("[Delete] Failed to remove Supabase image:", supabaseFilePath, removeError.message);
                deleteFailed = true;
              } else {
                console.log("[Delete] Removed Supabase image:", supabaseFilePath);
              }
            } catch (error) {
              console.warn("[Delete] Failed to remove Supabase image:", supabaseFilePath, error);
              deleteFailed = true;
            }
          }
        }
      }

      if (deleteFailed) {
        throw new Error("Failed to remove one or more product images from storage.");
      }
    }

    // Delete product from database
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", data.id);

    if (deleteError) {
      throw deleteError;
    }

    return { id: data.id };
  });

export const getProductById = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    const { data: product, error } = await supabase
      .from("products")
      .select(
        "id,name,price,description,images,tag,swatch,category,stock_qty,is_active,created_at,materials,dimensions,care_instructions,return_policy",
      )
      .eq("id", data.id)
      .single();

    if (error) {
      throw error;
    }

    return product;
  });

export const createProduct = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      price: z.number().min(0),
      description: z.string().optional(),
      category: z.string().optional(),
      tag: z.string().optional(),
      swatch: z.string().optional(),
      stock_qty: z.number().min(0),
      is_active: z.boolean(),
      images: z.array(z.string()).optional(),
      materials: z.string().max(5000).optional(),
      dimensions: z.string().max(2000).optional(),
      care_instructions: z.string().max(5000).optional(),
      return_policy: z.string().max(5000).optional(),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);
    const supabase = getSupabaseServer();

    const { data: created, error } = await supabase
      .from("products")
      .insert({
        name: data.name,
        price: data.price,
        description: data.description ?? null,
        category: data.category ?? null,
        tag: data.tag ?? null,
        swatch: data.swatch ?? null,
        stock_qty: data.stock_qty,
        is_active: data.is_active,
        images: data.images ?? [],
        materials: data.materials?.trim() || null,
        dimensions: data.dimensions?.trim() || null,
        care_instructions: data.care_instructions?.trim() || null,
        return_policy: data.return_policy?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !created) {
      throw error ?? new Error("Failed to create product.");
    }

    return created.id;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      price: z.number().min(0),
      description: z.string().optional(),
      category: z.string().optional(),
      tag: z.string().optional(),
      swatch: z.string().optional(),
      stock_qty: z.number().min(0),
      is_active: z.boolean(),
      images: z.array(z.string()).optional(),
      materials: z.string().max(5000).optional(),
      dimensions: z.string().max(2000).optional(),
      care_instructions: z.string().max(5000).optional(),
      return_policy: z.string().max(5000).optional(),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);
    const supabase = getSupabaseServer();

    const { data: updated, error } = await supabase
      .from("products")
      .update({
        name: data.name,
        price: data.price,
        description: data.description ?? null,
        category: data.category ?? null,
        tag: data.tag ?? null,
        swatch: data.swatch ?? null,
        stock_qty: data.stock_qty,
        is_active: data.is_active,
        images: data.images ?? [],
        materials: data.materials?.trim() || null,
        dimensions: data.dimensions?.trim() || null,
        care_instructions: data.care_instructions?.trim() || null,
        return_policy: data.return_policy?.trim() || null,
      })
      .eq("id", data.id)
      .select("id")
      .single();

    if (error || !updated) {
      throw error ?? new Error("Failed to update product.");
    }

    return updated;
  });

export const getOrdersList = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,order_number,user_id,total_amount,status,created_at,shipping_address")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const userIds = Array.from(new Set(orders?.map((order) => order.user_id).filter(Boolean)));
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", userIds);

  if (profileError) {
    throw profileError;
  }

  const userMap = new Map(profileRows?.map((user) => [user.id, user.email]));

  return (orders ?? []).map((order) => ({
    id: order.id,
    order_number: order.order_number ?? null,
    // Authenticated orders use the profile email; guest orders fall back to
    // the email captured in shipping_address at checkout.
    user_email:
      userMap.get(order.user_id) ??
      ((order.shipping_address as Record<string, string> | null)?.email ?? "Unknown"),
    total_amount: order.total_amount,
    status: order.status,
    created_at: order.created_at,
  }));
});

export const getOrderDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await verifyAdmin();
    const supabase = getSupabaseServer();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,status,total_amount,shipping_address,created_at,user_id")
      .eq("id", data.id)
      .single();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      throw new Error("Order not found");
    }

    let user: { username: string | null; email: string | null } | null = null;
    if (order.user_id) {
      const { data: profileRow, error: userError } = await supabase
        .from("profiles")
        .select("username,email")
        .eq("id", order.user_id)
        .maybeSingle();

      if (userError) {
        throw userError;
      }
      user = profileRow;
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id,product_id,qty,price_at_purchase")
      .eq("order_id", data.id);

    if (itemsError) {
      throw itemsError;
    }

    const productIds = Array.from(new Set(items?.map((item) => item.product_id).filter(Boolean)));
    let products: { id: string; name: string; images?: string[] | null }[] = [];
    if (productIds.length > 0) {
      const { data, error: productsError } = await supabase
        .from("products")
        .select("id,name,images")
        .in("id", productIds);

      if (productsError) {
        throw productsError;
      }
      products = data ?? [];
    }

    const productMap = new Map(products?.map((product) => [product.id, product]));

    const resultItems = (items ?? []).map((item) => {
      const product = productMap.get(item.product_id);
      return {
        id: item.id,
        product_name: product?.name ?? "Unknown product",
        product_image: product?.images?.[0] ?? null,
        qty: item.qty,
        price_at_purchase: item.price_at_purchase,
      };
    });

    return {
      id: order.id,
      order_number: order.order_number ?? null,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      shipping_address: order.shipping_address ?? null,
      customer: {
        // Authenticated orders use the profile; guest orders fall back to the
        // name/email captured in shipping_address at checkout.
        name:
          user?.username ??
          ((order.shipping_address as Record<string, string> | null)?.name ?? null),
        email:
          user?.email ??
          ((order.shipping_address as Record<string, string> | null)?.email ?? null),
      },
      items: resultItems,
    };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]), accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);
    const supabase = getSupabaseServer();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id,status")
      .eq("id", data.id)
      .single();

    if (fetchError || !order) {
      throw fetchError ?? new Error("Order not found.");
    }

    if (data.status === "cancelled" && order.status !== "cancelled") {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id,qty")
        .eq("order_id", data.id);

      for (const item of items ?? []) {
        await restoreStock(supabase, item.product_id, item.qty);
      }
    }

    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id,status");

    if (error || !updated) {
      throw error ?? new Error("Failed to update order status.");
    }

    return updated[0];
  });

export type AnalyticsData = {
  revenueSeries: { date: string; revenue: number }[];
  statusSeries: { status: string; count: number }[];
  topProducts: { name: string; revenue: number; sales: number }[];
  allTimeRevenue: number;
  allTimeOrderCount: number;
  avgOrderValue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  newCustomersThisMonth: number;
  newCustomersLastMonth: number;
  lowStockCount: number;
  categoryRevenue: { name: string; revenue: number }[];
  customerGrowth: { month: string; count: number }[];
};

export const getAnalyticsData = createServerFn({ method: "GET" }).handler(async () => {
  await verifyAdmin();
  const supabase = getSupabaseServer();

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

  const twelveMonthsAgo = new Date(today);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [
    { data: orders, error: ordersError },
    { data: allOrders, error: allOrdersError },
    { data: items, error: itemsError },
    { data: products, error: productsError },
    { data: users, error: usersError },
    { count: lowStockCount, error: lowStockError },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id,total_amount,status,created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id,total_amount,created_at"),
    supabase
      .from("order_items")
      .select("product_id,qty,price_at_purchase"),
    supabase
      .from("products")
      .select("id,name,category"),
    supabase
      .from("profiles")
      .select("id,created_at")
      .gte("created_at", twelveMonthsAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .lt("stock_qty", 5),
  ]);

  if (ordersError) throw ordersError;
  if (allOrdersError) throw allOrdersError;
  if (itemsError) throw itemsError;
  if (productsError) throw productsError;
  if (usersError) throw usersError;
  if (lowStockError) throw lowStockError;

  const todayData = orders ?? [];
  const revenueByDate = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let dailyDate = new Date(start);

  for (let i = 0; i < 30; i += 1) {
    const key = dailyDate.toISOString().slice(0, 10);
    revenueByDate.set(key, 0);
    dailyDate.setDate(dailyDate.getDate() + 1);
  }

  (todayData ?? []).forEach((order) => {
    const day = order.created_at?.slice(0, 10) ?? "";
    const prevRevenue = revenueByDate.get(day) ?? 0;
    revenueByDate.set(day, prevRevenue + order.total_amount);
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
  });

  const statusArray = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));
  const revenueSeries = Array.from(revenueByDate.entries()).map(([date, revenue]) => ({ date, revenue }));

  const productMap = new Map<string, string>();
  const productCategoryMap = new Map<string, string>();
  (products ?? []).forEach((product) => {
    productMap.set(product.id, product.name ?? "Unknown");
    productCategoryMap.set(product.id, product.category ?? "Uncategorized");
  });

  const productData = new Map<string, { revenue: number; sales: number }>();
  (items ?? []).forEach((item) => {
    const productName = productMap.get(item.product_id) ?? "Unknown";
    const existing = productData.get(productName) ?? { revenue: 0, sales: 0 };
    existing.revenue += item.qty * item.price_at_purchase;
    existing.sales += item.qty;
    productData.set(productName, existing);
  });

  const topProducts = Array.from(productData.entries())
    .map(([name, d]) => ({ name, revenue: d.revenue, sales: d.sales }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const catRevenueMap = new Map<string, number>();
  (items ?? []).forEach((item) => {
    const cat = productCategoryMap.get(item.product_id) ?? "Uncategorized";
    catRevenueMap.set(cat, (catRevenueMap.get(cat) ?? 0) + item.qty * item.price_at_purchase);
  });
  const categoryRevenue = Array.from(catRevenueMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const allOrdersData = allOrders ?? [];
  const allRevenue = allOrdersData.reduce((sum, order) => sum + order.total_amount, 0);
  const allOrderCount = allOrdersData.length;
  const avgOrderValue = allOrderCount > 0 ? allRevenue / allOrderCount : 0;

  const thisMonthOrders = allOrdersData.filter(
    (o) => o.created_at >= monthStart.toISOString(),
  );
  const lastMonthOrders = allOrdersData.filter(
    (o) => o.created_at >= lastMonthStart.toISOString() && o.created_at <= lastMonthEnd.toISOString(),
  );
  const revenueThisMonth = thisMonthOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const revenueLastMonth = lastMonthOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const ordersThisMonth = thisMonthOrders.length;
  const ordersLastMonth = lastMonthOrders.length;

  const usersData = users ?? [];
  const newCustomersThisMonth = usersData.filter(
    (u) => u.created_at >= monthStart.toISOString(),
  ).length;
  const newCustomersLastMonth = usersData.filter(
    (u) => u.created_at >= lastMonthStart.toISOString() && u.created_at <= lastMonthEnd.toISOString(),
  ).length;

  const monthLabels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const growthMap = new Map<string, number>();
  monthLabels.forEach((m) => growthMap.set(m, 0));
  usersData.forEach((u) => {
    if (u.created_at) {
      const key = u.created_at.slice(0, 7);
      if (growthMap.has(key)) {
        growthMap.set(key, (growthMap.get(key) ?? 0) + 1);
      }
    }
  });

  const customerGrowth = monthLabels.map((month) => ({
    month,
    count: growthMap.get(month) ?? 0,
  }));

  return {
    revenueSeries,
    statusSeries: statusArray,
    topProducts,
    allTimeRevenue: allRevenue,
    allTimeOrderCount: allOrderCount,
    avgOrderValue,
    revenueThisMonth,
    revenueLastMonth,
    ordersThisMonth,
    ordersLastMonth,
    newCustomersThisMonth,
    newCustomersLastMonth,
    lowStockCount: lowStockCount ?? 0,
    categoryRevenue,
    customerGrowth,
  } satisfies AnalyticsData;
});

export const uploadProductImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ fileName: z.string().min(1), base64: z.string().min(1), accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    await verifyAdmin(undefined, data.accessToken);

    const { Buffer } = await import("node:buffer");
    const mimeType = data.base64.match(/^data:(.*);base64,/)?.[1] ?? "application/octet-stream";
    const base64String = data.base64.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64String, "base64");

    // Product images allow up to 20MB pre-compression (client compresses before sending).
    validateImageBuffer(buffer);

    const filePath = `public/${Date.now()}-${data.fileName}`;

    const encodeR2ObjectKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

    // Primary: Upload to Cloudflare R2
    const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const r2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const r2ApiToken = process.env.CLOUDFLARE_R2_API_TOKEN;

    if (r2AccountId && r2BucketName && r2ApiToken) {
      try {
        const encodedObjectKey = encodeR2ObjectKey(filePath);
        const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${r2AccountId}/r2/buckets/${r2BucketName}/objects/${encodedObjectKey}`;
        console.log("[R2] Uploading to Cloudflare R2...");
        
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${r2ApiToken}`,
            "Content-Type": mimeType,
          },
          body: buffer,
        });

        const json = await response.json().catch(() => null);
        if (response.ok && json && json.success !== false) {
          // Return proxy URL instead of direct R2 URL (bypasses ORB)
          const proxyUrl = `/api/images/${encodeURIComponent(filePath)}`;
          console.log("[R2] Upload successful, using proxy URL:", proxyUrl);
          return { publicUrl: proxyUrl };
        } else {
          console.warn("[R2] Upload failed:", json?.errors?.[0]?.message);
          throw new Error(`R2 upload failed: ${json?.errors?.[0]?.message}`);
        }
      } catch (error) {
        console.error("[R2] Upload error:", error);
        throw error;
      }
    }

    // Fallback to Supabase if R2 not configured
    console.log("[Supabase] R2 not configured, using Supabase Storage");
    const supabase = getSupabaseServer();
    const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, buffer, {
      contentType: "image/*",
      upsert: false,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = await supabase.storage.from("product-images").getPublicUrl(filePath);
    if (!publicData) {
      throw new Error("Failed to generate public URL.");
    }

    console.log("[Supabase] Upload successful:", publicData.publicUrl);
    return { publicUrl: publicData.publicUrl };
  });

// ===== Authentication & User Profile Functions =====

export const signUpWithProfile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      username: z.string().min(2, "Username must be at least 2 characters").max(50, "Username is too long"),
      address: z.string().min(5, "Address must be at least 5 characters").max(200, "Address is too long"),
      ip: z.string().optional(),
      turnstileToken: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    if (data.turnstileToken) {
      const valid = await verifyTurnstile(data.turnstileToken);
      if (!valid) {
        throw new Error("CAPTCHA verification failed. Please refresh and try again.");
      }
    }

    const supabase = getSupabaseServer();

    // Rate-limit: allow a small number of signup attempts per IP per hour.
    // If no IP is provided, this will count under the 'unknown' bucket.
    try {
      const MAX_PER_HOUR = 5;
      const ip = data.ip ?? "unknown";
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: recentAttempts } = await supabase
        .from("signup_attempts")
        .select("id")
        .gte("created_at", hourAgo)
        .eq("ip", ip);

      if (recentAttempts && recentAttempts.length >= MAX_PER_HOUR) {
        throw new Error("Too many signup attempts from this IP. Please try again later.");
      }

      // Record this attempt (best-effort; ignore insert failures)
      await supabase.from("signup_attempts").insert({ ip });
    } catch (rateErr) {
      // If the rate-limit check threw, rethrow to the client.
      if (rateErr instanceof Error) throw rateErr;
    }

    // Check if user already exists in profiles
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .single();

    if (existingUser) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    // Check if user already exists in auth (partial signup may have left an auth user behind)
    try {
      const { data: authUsersData, error: authUsersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (!authUsersError && authUsersData?.users?.some((user) => user.email?.toLowerCase() === data.email.toLowerCase())) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }
    } catch {
      // Ignore admin lookup failures and continue with signup flow.
    }

    // Check if username is taken
    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username.toLowerCase())
      .single();

    if (existingUsername) {
      throw new Error("This username is already taken");
    }

    // Create user via Supabase Admin API (service role required for `.admin.createUser`).
    // This bypasses the automatic verification email flow and lets us mark the
    // profile as verified immediately for a smoother UX while keeping a rate-limit.
    let userId: string;
    let message = "Account created. You can sign in now.";

    try {
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
      } as any);

      if (createError) {
        throw createError;
      }

      // `createData.user.id` is expected. If SDK shape differs, guard accordingly.
      userId = (createData as any)?.user?.id ?? (createData as any)?.id;
      if (!userId) throw new Error("Failed to create user account");

      // Try to mark auth user as confirmed via admin API to avoid Supabase
      // preventing sign-in due to unconfirmed email. This uses best-effort
      // calls and will not block signup on failure.
      try {
        const adminApi = (supabase.auth as any).admin;
        if (adminApi?.updateUserById) {
          await adminApi.updateUserById(userId, { email_confirm: true });
        } else if (adminApi?.updateUser) {
          await adminApi.updateUser(userId, { email_confirm: true });
        } else if (adminApi?.update) {
          await adminApi.update(userId, { email_confirm: true });
        }
      } catch (confirmErr) {
        // ignore — fallback below handles signIn issues via profile flag
        console.warn("Could not programmatically confirm auth user:", confirmErr);
      }
    } catch (createErr) {
      // If admin.createUser isn't permitted in your environment (no service role),
      // fall back to signUp and continue but note this may still send verification
      // emails depending on Supabase project settings.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user?.id) throw new Error("Failed to create user account");
      userId = authData.user.id;

      // If we used signUp fallback, try to immediately mark the auth user as confirmed
      // via admin API (best-effort). This helps avoid Supabase blocking sign-in.
      try {
        const adminApi = (supabase.auth as any).admin;
        if (adminApi?.updateUserById) {
          await adminApi.updateUserById(userId, { email_confirm: true });
        } else if (adminApi?.updateUser) {
          await adminApi.updateUser(userId, { email_confirm: true });
        } else if (adminApi?.update) {
          await adminApi.update(userId, { email_confirm: true });
        }
      } catch (confirmErr) {
        console.warn("Could not programmatically confirm auth user (fallback):", confirmErr);
      }
    }

    // Create user profile and mark email as verified immediately
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      address: data.address,
      email_verified: true,
    });

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      throw new Error("Failed to create user profile. Please try again.");
    }

    return {
      success: true,
      message,
      userId,
    };
  });

export const validateCartItems = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      items: z.array(
        z.object({
          product_id: z.string(),
          qty: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    const productIds = Array.from(new Set(data.items.map((item) => item.product_id)));
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, is_active, stock_qty")
      .in("id", productIds);

    if (error) throw error;

    const productMap = new Map(products?.map((p) => [p.id, p]));
    const unavailable: { product_id: string; name: string; reason: string }[] = [];

    for (const item of data.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        unavailable.push({ product_id: item.product_id, name: "Unknown product", reason: "not_found" });
      } else if (!product.is_active) {
        unavailable.push({ product_id: item.product_id, name: product.name, reason: "inactive" });
      } else if (item.qty > (product.stock_qty ?? 0)) {
        unavailable.push({ product_id: item.product_id, name: product.name, reason: "out_of_stock" });
      }
    }

    return {
      available: products?.filter((p) => p.is_active && (p.stock_qty ?? 0) > 0) ?? [],
      unavailable,
    };
  });

export const saveCartForUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      items: z.array(
        z.object({
          product_id: z.string(),
          name: z.string(),
          price: z.number(),
          qty: z.number(),
          image: z.string().nullable().optional(),
          swatch: z.string().nullable().optional(),
          stock_qty: z.number().nullable().optional(),
        }),
      ),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        throw new Error("Authentication required to save cart.");
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) throw new Error("Authentication required to save cart.");

    // Service-role client for DB writes (bypasses RLS, safe since we validated auth above)
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("carts")
      .upsert({ user_id: userId, items: data.items, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) throw error;
    return { success: true };
  });

export const getCartForUser = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        return { items: [] };
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) return { items: [] };

    // Service-role client for DB reads (bypasses RLS, safe since we validated auth above)
    const supabase = getSupabaseServer();
    const { data: cartData, error } = await supabase.from("carts").select("items").eq("user_id", userId).single();
    if (error) return { items: [] };
    return { items: (cartData as any)?.items ?? [] };
  });

export const getMyOrders = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        return [] as any[];
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) return [] as any[];

    // Service-role client for DB reads (bypasses RLS, safe since we validated auth above)
    const supabase = getSupabaseServer();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id,status,total_amount,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (orders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
    }));
  });

export const getCustomerOrders = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        return [];
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) return [];

    const supabase = getSupabaseServer();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,order_number,status,total_amount,created_at,shipping_address,payment_method,payment_status,
        order_items(
          id,qty,price_at_purchase,
          product_id,
          products(name,images)
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (orders ?? []).map((o) => ({
      id: o.id,
      order_number: o.order_number ?? null,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
      shipping_address: o.shipping_address as Record<string, string> | null,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      items: ((o as any).order_items ?? []).map((item: any) => ({
        product_id: item.product_id,
        name: item.products?.name ?? "Unknown",
        image: item.products?.images?.[0] ?? null,
        qty: item.qty,
        price_at_purchase: item.price_at_purchase,
      })),
    }));
  });

export const getCustomerOrderById = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().optional(),
      orderId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        throw new Error("Authentication required");
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) {
      throw new Error("Authentication required");
    }

    const supabase = getSupabaseServer();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,status,total_amount,created_at,payment_method,payment_status,shipping_address,user_id")
      .eq("id", data.orderId)
      .single();

    if (orderError || !order) {
      throw orderError ?? new Error("Order not found.");
    }

    if (order.user_id !== userId) {
      throw new Error("You can only view your own order.");
    }

    return {
      id: order.id,
      order_number: order.order_number ?? null,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      shipping_address: order.shipping_address as Record<string, string> | null,
    };
  });

// Guest orders list: all orders placed without an account, matched by the
// email stored in shipping_address. No session required.
export const getGuestOrders = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();
    const email = data.email.toLowerCase();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,order_number,status,total_amount,created_at,shipping_address,payment_method,payment_status,
        order_items(
          id,qty,price_at_purchase,
          product_id,
          products(name,images)
        )
      `)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const guestOrders = (orders ?? [])
      .filter((o) => {
        const addr = o.shipping_address as Record<string, string> | null;
        return addr?.email?.toLowerCase() === email;
      })
      .slice(0, 50);

    return guestOrders.map((o) => ({
      id: o.id,
      order_number: o.order_number ?? null,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
      shipping_address: o.shipping_address as Record<string, string> | null,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      items: ((o as any).order_items ?? []).map((item: any) => ({
        product_id: item.product_id,
        name: item.products?.name ?? "Unknown",
        image: item.products?.images?.[0] ?? null,
        qty: item.qty,
        price_at_purchase: item.price_at_purchase,
      })),
    }));
  });

// Guest order lookup: verify ownership via order ID + matching email in shipping_address.
// No session required — guests retrieve orders by their email and order ID.
export const getGuestOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      email: z.string().email(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,order_number,status,total_amount,created_at,payment_method,payment_status,shipping_address,user_id,
        order_items(
          id,qty,price_at_purchase,
          product_id,
          products(name,images)
        )
      `)
      .eq("id", data.orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found.");
    }

    // Only allow lookup for guest orders (user_id IS NULL)
    if (order.user_id !== null) {
      throw new Error("This is not a guest order. Please log in to view it.");
    }

    // Verify email matches the shipping address
    const shippingEmail = (order.shipping_address as Record<string, string>)?.email;
    if (!shippingEmail || shippingEmail.toLowerCase() !== data.email.toLowerCase()) {
      throw new Error("Email does not match this order.");
    }

    return {
      id: order.id,
      order_number: order.order_number ?? null,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      shipping_address: order.shipping_address as Record<string, string> | null,
      items: ((order as any).order_items ?? []).map((item: any) => ({
        product_id: item.product_id,
        name: item.products?.name ?? "Unknown",
        image: item.products?.images?.[0] ?? null,
        qty: item.qty,
        price_at_purchase: item.price_at_purchase,
      })),
    };
  });

export const cancelCustomerOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        throw new Error("Authentication required");
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) {
      throw new Error("Authentication required");
    }

    const supabase = getSupabaseServer();

    // Fetch the order and verify ownership
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id,status,user_id")
      .eq("id", data.orderId)
      .single();

    if (fetchError || !order) {
      throw fetchError ?? new Error("Order not found.");
    }

    if (order.user_id !== userId) {
      throw new Error("You can only cancel your own orders.");
    }

    if (order.status !== "pending") {
      throw new Error("Only pending orders can be cancelled. This order has already been processed.");
    }

    // Restore stock for each item
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id,qty")
      .eq("order_id", data.orderId);

    for (const item of items ?? []) {
      await restoreStock(supabase, item.product_id, item.qty);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", data.orderId);

    if (updateError) throw updateError;

    // Reject any still-pending GCash proofs so a later admin approval
    // cannot resurrect this cancelled order.
    await supabase
      .from("gcash_payments")
      .update({ status: "rejected", verified_at: new Date().toISOString() })
      .eq("order_id", data.orderId)
      .eq("status", "pending");

    return { success: true, message: "Order cancelled successfully." };
  });

// Guest order cancel: same rules as cancelCustomerOrder but ownership is
// proven by the email in shipping_address instead of an account token.
export const cancelGuestOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      email: z.string().email(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id,status,user_id,shipping_address")
      .eq("id", data.orderId)
      .single();

    if (fetchError || !order) {
      throw fetchError ?? new Error("Order not found.");
    }

    if (order.user_id !== null) {
      throw new Error("This is not a guest order. Please log in to cancel it.");
    }

    const shippingEmail = (order.shipping_address as Record<string, string>)?.email;
    if (!shippingEmail || shippingEmail.toLowerCase() !== data.email.toLowerCase()) {
      throw new Error("Email does not match this order.");
    }

    if (order.status !== "pending") {
      throw new Error("Only pending orders can be cancelled. This order has already been processed.");
    }

    // Restore stock for each item
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id,qty")
      .eq("order_id", data.orderId);

    for (const item of items ?? []) {
      await restoreStock(supabase, item.product_id, item.qty);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", data.orderId);

    if (updateError) throw updateError;

    // Reject any still-pending GCash proofs so a later admin approval
    // cannot resurrect this cancelled order.
    await supabase
      .from("gcash_payments")
      .update({ status: "rejected", verified_at: new Date().toISOString() })
      .eq("order_id", data.orderId)
      .eq("status", "pending");

    return { success: true, message: "Order cancelled successfully." };
  });

export const verifyEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        token: z.string().min(1).optional(),
        token_hash: z.string().min(1).optional(),
        email: z.string().email("Invalid email address").optional(),
        type: z.string().optional(),
      })
      .refine(
        (value) => (value.token && value.email) || value.token_hash,
        {
          message: "A token and email or a token_hash are required",
          path: ["token"],
        }
      )
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();

    const verifyPayload: Record<string, string> = {};
    if (data.token_hash) {
      verifyPayload.token_hash = data.token_hash;
    } else {
      verifyPayload.token = data.token!;
      verifyPayload.email = data.email!;
    }
    verifyPayload.type = data.type ?? "signup";

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp(verifyPayload as any);

    if (verifyError || !verifyData?.user?.id) {
      throw new Error("Invalid or expired verification link. Please try signing up again.");
    }

    // Update profile to mark email as verified
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", verifyData.user.id);

    if (updateError) {
      throw new Error("Failed to verify email. Please try again.");
    }

    return {
      success: true,
      message: "Email verified successfully! You can now log in.",
      userId: verifyData.user.id,
    };
  });

export const checkEmailVerification = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServer();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email_verified")
      .eq("id", data.userId)
      .single();

    if (error || !profile) {
      throw new Error("User profile not found");
    }

    return { emailVerified: profile.email_verified ?? false };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      username: z.string().min(2, "Username must be at least 2 characters").max(50, "Username is too long"),
      address: z.string().min(5, "Address must be at least 5 characters").max(200, "Address is too long"),
      accessToken: z.string().optional(),
      turnstileToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.turnstileToken) {
      const valid = await verifyTurnstile(data.turnstileToken);
      if (!valid) {
        throw new Error("CAPTCHA verification failed. Please try again.");
      }
    }

    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        throw new Error("Authentication required");
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) {
      throw new Error("Authentication required");
    }

    const supabase = getSupabaseServer();

    // Check if username is taken by another user
    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username.toLowerCase())
      .neq("id", userId)
      .single();

    if (existingUsername) {
      throw new Error("This username is already taken");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: data.username.toLowerCase(), address: data.address })
      .eq("id", userId);

    if (error) throw error;

    return { success: true, message: "Profile updated successfully!" };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      newPassword: z.string().min(8, "New password must be at least 8 characters"),
      turnstileToken: z.string().optional(),
      accessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.turnstileToken) {
      const valid = await verifyTurnstile(data.turnstileToken);
      if (!valid) {
        throw new Error("CAPTCHA verification failed. Please try again.");
      }
    }

    const authClient = getSupabaseServer(undefined, { authOnly: true });

    let userId: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (tokenResult.error) {
        throw new Error("Authentication required");
      }
      userId = tokenResult.data?.user?.id ?? null;
    }
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Get user email before admin API call (which invalidates all sessions)
    let userEmail: string | null = null;
    if (data.accessToken) {
      const tokenResult = await authClient.auth.getUser(data.accessToken);
      if (!tokenResult.error) {
        userEmail = tokenResult.data?.user?.email ?? null;
      }
    }

    const supabase = getSupabaseServer();
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: data.newPassword,
    });

    if (updateError) throw updateError;

    // Re-authenticate with new password so the user isn't logged out
    // (admin.updateUserById invalidates ALL sessions)
    if (userEmail) {
      const { error: signInError } = await authClient.auth.signInWithPassword({
        email: userEmail,
        password: data.newPassword,
      });
      if (signInError) {
        console.error("[changePassword] Failed to re-establish session:", signInError);
      }
    }

    return { success: true, message: "Password changed successfully!" };
  });

export const checkIsAdmin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().optional() }))
  .handler(async ({ data }) => {
    try {
      await verifyAdmin(undefined, data.accessToken);
      return { isAdmin: true };
    } catch {
      return { isAdmin: false };
    }
  });

export const verifyLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      turnstileToken: z.string().optional(),
      ip: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.turnstileToken) {
      const valid = await verifyTurnstile(data.turnstileToken);
      if (!valid) {
        throw new Error("CAPTCHA verification failed. Please try again.");
      }
    }

    if (data.ip) {
      const supabase = getSupabaseServer();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip", data.ip)
        .gte("created_at", oneHourAgo);

      if (error) throw error;

      if (count !== null && count >= 5) {
        throw new Error("Too many login attempts. Please try again in an hour.");
      }
    }

    return { ok: true };
  });

export const recordLoginFailure = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ip: z.string().optional() }))
  .handler(async ({ data }) => {
    if (!data.ip) return { ok: true };

    const supabase = getSupabaseServer();
    const { error } = await supabase.from("login_attempts").insert({ ip: data.ip });

    if (error) {
      console.error("[recordLoginFailure] Failed to record attempt:", error);
    }

    return { ok: true };
  });
