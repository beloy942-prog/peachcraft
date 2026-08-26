import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createOrder, getCustomerOrderById, getGuestOrder, getUserActiveOrderStatus, uploadPaymentProof, submitGCashProof, checkDuplicateReference, validateCartItems } from "@/lib/api/supabase.functions";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { getStoreDetails } from "@/lib/api/storeDetails.functions";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency-context";
import { ArrowLeft, CheckCircle, Copy, Loader2, Upload } from "lucide-react";

type GcashConfig = {
  number: string;
  name: string;
  qrCodeSrc: string;
};

const DEFAULT_GCASH_CONFIG: GcashConfig = {
  number: "0917 123 4567",
  name: "Peach Craft PH",
  qrCodeSrc: "/images/gcash-qr-placeholder.png",
};

const step1Schema = z.object({
  name: z.string().min(1, "Please enter your full name."),
  email: z.string().min(1, "Please enter your email address.").email("Please enter a valid email address."),
  street: z.string().min(1, "Please enter a street address."),
  city: z.string().min(1, "Please enter a city."),
  province: z.string().min(1, "Please enter a province."),
  zip: z.string().min(1, "Please enter a postal code."),
});

const shippingSchema = step1Schema.extend({
  payment_method: z.enum(["cash_on_delivery", "gcash"]),
});

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
});

// Deterministic fallback for pre-migration orders that lack a stored order_number.
// Uses the order's created_at date (not the current client time) so it's reproducible.
function fallbackDisplayOrderId(orderUuid: string, createdAt: string): string {
  const date = new Date(createdAt);
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = orderUuid.replace(/-/g, "").slice(0, 3).toUpperCase();
  return `PTT-${yyyymmdd}-${suffix}`;
}

/** Resolve the display order ID: prefer server-stored order_number, fall back to deterministic computation. */
function resolveDisplayOrderId(order: { id: string; order_number?: string | null; created_at?: string }): string {
  if (order.order_number) return order.order_number;
  return fallbackDisplayOrderId(order.id, order.created_at ?? new Date().toISOString());
}

// Reload recovery: the in-progress checkout (step + typed info) is kept in
// sessionStorage so a browser refresh restores the customer to the same step
// instead of dropping them back to an empty form.
const CHECKOUT_DRAFT_KEY = "peachcraft-checkout-draft";

type CheckoutDraft = {
  step: 1 | 2 | 3 | 4;
  name: string;
  email: string;
  street: string;
  city: string;
  province: string;
  zip: string;
  paymentMethod: string;
  displayOrderId: string | null;
};

function loadCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCheckoutDraft(draft: CheckoutDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

function clearCheckoutDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {}
}

function CheckoutPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const orderIdQuery = search.orderId;
  const { items, subtotal, itemCount, clear } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [zip, setZip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("gcash");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [hasActiveOrder, setHasActiveOrder] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [resumeOrder, setResumeOrder] = useState<{
    id: string;
    status: string;
    total_amount: number;
    payment_method: string | null;
    payment_status: string | null;
    shipping_address: Record<string, string> | null;
  } | null>(null);
  const [resumeOrderLoaded, setResumeOrderLoaded] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [guestResumeEmail, setGuestResumeEmail] = useState("");
  const [guestResumeLoading, setGuestResumeLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { loading: authLoading, isAuthenticated, session: authSession, user: authUser } = useAuth();
  const checkingAuth = authLoading;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [displayOrderId, setDisplayOrderId] = useState<string | null>(null);

  const [gcashRefNo, setGcashRefNo] = useState("");
  const [gcashEmail, setGcashEmail] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step2Checking, setStep2Checking] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { formatPrice } = useCurrency();
  const accessTokenRef = useRef<string | null>(null);
  const shippingFee = 150;
  const taxAmount = 0;
  const totalAmount = subtotal + shippingFee + taxAmount;
  const gcashEmailMismatch = gcashEmail.trim() !== "" && email.trim() !== "" &&
    gcashEmail.trim().toLowerCase() !== email.trim().toLowerCase();
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [gcashConfig, setGcashConfig] = useState<GcashConfig>(DEFAULT_GCASH_CONFIG);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setClientIp(d.ip))
      .catch(() => {});
  }, []);

  // Restore a saved checkout draft on mount so a reload keeps the customer on
  // the same step with their info intact. Skipped when an ?orderId= resume
  // flow is driving the page. Step 4 is only restored when it represents a
  // real completed order (displayOrderId present) to avoid a fake success screen.
  useEffect(() => {
    if (orderIdQuery) {
      setDraftReady(true);
      return;
    }
    const draft = loadCheckoutDraft();
    if (!draft) {
      setDraftReady(true);
      return;
    }
    if (draft.name) setName(draft.name);
    if (draft.email) setEmail(draft.email);
    if (draft.street) setStreet(draft.street);
    if (draft.city) setCity(draft.city);
    if (draft.province) setProvince(draft.province);
    if (draft.zip) setZip(draft.zip);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.displayOrderId) setDisplayOrderId(draft.displayOrderId);
    if (draft.step === 4 && draft.displayOrderId) {
      setSuccessMessage(
        draft.paymentMethod === "gcash"
          ? "Your payment proof has been submitted. We'll verify and confirm your order shortly."
          : "Your order is confirmed! We will reach out once it ships.",
      );
      setStep(4);
    } else if (draft.step === 2 || draft.step === 3) {
      setStep(draft.step);
    }
    setDraftReady(true);
    // Run once on mount; orderIdQuery is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the saved draft in sync with the current checkout state — but only
  // after the restore attempt, otherwise the first (empty) render would
  // overwrite the saved draft before it is read.
  useEffect(() => {
    if (!draftReady) return;
    saveCheckoutDraft({ step, name, email, street, city, province, zip, paymentMethod, displayOrderId });
  }, [draftReady, step, name, email, street, city, province, zip, paymentMethod, displayOrderId]);

  // Load admin-managed GCash payment details (fallback to defaults)
  useEffect(() => {
    let mounted = true;
    getStoreDetails()
      .then((details) => {
        if (!mounted || !details) return;
        setGcashConfig((config) => ({
          number: details.gcash_number || config.number,
          name: details.gcash_account_name || config.name,
          qrCodeSrc: details.gcash_qr || config.qrCodeSrc,
        }));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Background fetch: profile + active order (non-blocking)
  useEffect(() => {
    if (!authSession?.user?.id) return;
    let mounted = true;
    const userId = authSession.user.id;
    accessTokenRef.current = authSession.access_token;
    // Prefill from the account, but never overwrite info the customer already
    // typed or that was restored from a saved checkout draft.
    setEmail((prev) => prev || authSession.user?.email || "");

    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("email_verified, username, address")
          .eq("id", userId)
          .single();
        if (!mounted) return;
        if (profile) {
          setIsVerified(!!profile.email_verified);
          setName((prev) => prev || profile.username || "");
          setStreet((prev) => prev || profile.address || "");
        } else {
          setIsVerified(false);
        }
      } catch {}
    })();

    getUserActiveOrderStatus({ data: { accessToken: authSession.access_token } })
      .then((activeStatus) => {
        if (!mounted) return;
        setHasActiveOrder(activeStatus.hasActiveOrder);
        setActiveOrderId(activeStatus.activeOrder?.id ?? null);
      })
      .catch(() => {});

    if (orderIdQuery) {
      getCustomerOrderById({ data: { accessToken: authSession.access_token, orderId: orderIdQuery } })
        .then((order) => {
          if (!mounted) return;
          setResumeOrder(order);
          setResumeOrderLoaded(true);
          if (order.payment_method === "gcash" && order.payment_status === "pending") {
            setPaymentMethod("gcash");
            setOrderId(order.id);
            setDisplayOrderId(resolveDisplayOrderId(order));
            setStep(3);
          }
        })
        .catch(() => {
          if (!mounted) return;
          setResumeError("Unable to resume this order. Please proceed from your order history.");
          setResumeOrderLoaded(true);
        });
    }


    return () => { mounted = false; };
  }, [authSession]);

  // Guest checkout: no forced redirect to /login. Guests can proceed directly.

  const queryClient = useQueryClient();

  const createOrderMutation = useMutation({
    mutationFn: async (payload: Omit<Parameters<typeof createOrder>[0]["data"], "accessToken" | "turnstileToken" | "ip">) => {
      return createOrder({
        data: {
          ...payload,
          accessToken: accessTokenRef.current ?? undefined,
          ip: clientIp ?? undefined,
        },
      });
    },
    onSuccess: (result) => {
      setOrderId(result.id);
      setDisplayOrderId(result.order_number ?? fallbackDisplayOrderId(result.id, new Date().toISOString()));
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      // Pre-fill GCash email from shipping email (for guests, gcashEmail may be empty)
      if (!gcashEmail && email) {
        setGcashEmail(email);
      }
      if (paymentMethod === "cash_on_delivery") {
        clear();
        setSuccessMessage("Your order is confirmed! We will reach out once it ships.");
        setStep(4);
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: { fileName: string; base64: string }) => {
      return uploadPaymentProof({ data: { ...payload, accessToken: accessTokenRef.current ?? undefined } });
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof submitGCashProof>[0]["data"]) => {
      return submitGCashProof({ data: { ...payload, accessToken: accessTokenRef.current ?? undefined } });
    },
    onSuccess: () => {
      clear();
      setSuccessMessage("Your payment proof has been submitted. We'll verify and confirm your order shortly.");
      setStep(4);
    },
  });

  // Validates the shipping form + cart contents. Returns the parsed values on
  // success, or null after surfacing field/general errors. Does NOT create
  // anything — order creation only happens on the explicit confirm action.
  const validateCheckout = async (): Promise<z.infer<typeof shippingSchema> | null> => {
    setFormErrors({});
    if (items.length === 0) {
      setFormErrors({ general: "Your cart is empty." });
      return null;
    }
    const result = shippingSchema.safeParse({
      name, email, street, city, province, zip,
      payment_method: paymentMethod,
    });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        newErrors[issue.path[0] as string] = issue.message;
      }
      // General message too: the review step renders only `general`, so a
      // shipping-field problem must still be visible when confirming there.
      newErrors.general = "Please go back and complete your shipping details.";
      setFormErrors(newErrors);
      return null;
    }

    // Validate cart items against the database
    try {
      const validation = await validateCartItems({
        data: {
          items: items.map((item) => ({
            product_id: item.product_id,
            qty: item.qty,
          })),
        },
      });
      if (validation.unavailable.length > 0) {
        const names = validation.unavailable.map((u) => `"${u.name}"`).join(", ");
        const msg = validation.unavailable.every((u) => u.reason === "out_of_stock")
          ? `Some items are out of stock: ${names}. Please remove them and try again.`
          : `Some items are no longer available: ${names}. They have been removed from your cart.`;
        // Remove unavailable items from local storage
        const unavailableIds = new Set(validation.unavailable.map((u) => u.product_id));
        const filtered = items.filter((i) => !unavailableIds.has(i.product_id));
        if (typeof window !== "undefined") {
          window.localStorage.setItem("peachcraft-cart", JSON.stringify(filtered));
        }
        window.dispatchEvent(new Event("peachcraft-cart-updated"));
        setFormErrors({ general: msg });
        return null;
      }
    } catch (_err) {
      // If validation fails, just proceed and let createOrder handle it
    }

    return result.data;
  };

  // Creates the order. Only called from the explicit confirm action on the
  // review step — never on "continue" navigation. Reuses an order from a
  // previous attempt so a partial failure (e.g. screenshot upload failed)
  // never double-orders.
  const placeOrder = async (parsed: z.infer<typeof shippingSchema>): Promise<string | null> => {
    if (orderId) return orderId;
    try {
      const res = await createOrderMutation.mutateAsync({
        items: items.map((item) => ({
          product_id: item.product_id,
          qty: item.qty,
          price_at_purchase: item.price,
        })),
        shipping_address: {
          name: parsed.name,
          email: parsed.email,
          street: parsed.street,
          city: parsed.city,
          province: parsed.province,
          zip: parsed.zip,
        },
        total_amount: totalAmount,
        payment_method: parsed.payment_method,
      });
      if (res && res.id) {
        setOrderId(res.id);
        setDisplayOrderId(res.order_number ?? fallbackDisplayOrderId(res.id, new Date().toISOString()));
      }
      return res?.id ?? null;
    } catch (error) {
      setFormErrors({ general: error instanceof Error ? error.message : "Unable to place order." });
      return null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // The explicit confirm action for GCash orders: validates everything, THEN
  // creates the order, uploads the proof, and links it. A reload before this
  // point never leaves an order behind.
  const handleSubmitProof = async () => {
    setRefError(null);
    setFormErrors({});
    if (!gcashRefNo.trim()) {
      setRefError("Please enter the GCash reference number.");
      return;
    }
    if (!screenshotFile) {
      setFormErrors({ screenshot: "Please upload a screenshot of your payment." });
      return;
    }
    const proofEmail = gcashEmail.trim();
    if (!proofEmail) {
      setFormErrors({ gcashEmail: "Please enter your email address." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proofEmail)) {
      setFormErrors({ gcashEmail: "Please enter a valid email address." });
      return;
    }

    try {
      const dupCheck = await checkDuplicateReference({ data: { gcash_reference_number: gcashRefNo.trim() } });
      if (dupCheck.isDuplicate) {
        setRefError("This GCash reference number has already been used.");
        return;
      }
    } catch {
      // continue anyway — DB constraint will catch duplicates
    }

    // Shipping + cart validation at confirm time, so the order is only
    // created once every check has passed.
    const parsed = await validateCheckout();
    if (!parsed) return;

    // Upload screenshot BEFORE creating the order so a failed upload
    // never leaves an orphaned order row in the database.
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(screenshotFile);
    });

    let screenshotUrl: string;
    try {
      const uploadResult = await uploadMutation.mutateAsync({
        fileName: screenshotFile.name,
        base64,
      });
      screenshotUrl = uploadResult.publicUrl;
    } catch (err) {
      setFormErrors({ screenshot: err instanceof Error ? err.message : "Failed to upload screenshot." });
      return;
    }

    const createdOrderId = await placeOrder(parsed);
    if (!createdOrderId) return;

    try {
      await submitProofMutation.mutateAsync({
        order_id: createdOrderId,
        gcash_reference_number: gcashRefNo.trim(),
        screenshot_url: screenshotUrl,
        customer_email: proofEmail,
      });
    } catch (err) {
      setFormErrors({ general: err instanceof Error ? err.message : "Failed to submit payment proof." });
    }
  };

  // The explicit confirm action for COD orders: validate, then create.
  // createOrderMutation.onSuccess handles cart clear + confirmation screen.
  const handleConfirmCodOrder = async () => {
    const parsed = await validateCheckout();
    if (!parsed) return;
    await placeOrder(parsed);
  };

  const handleCopyOrderId = () => {
    if (displayOrderId) {
      navigator.clipboard.writeText(displayOrderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGuestResume = async () => {
    const trimmed = guestResumeEmail.trim();
    if (!trimmed) {
      setResumeError("Please enter the email you used at checkout.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResumeError("Please enter a valid email address.");
      return;
    }
    setResumeError(null);
    setGuestResumeLoading(true);
    try {
      const order = await getGuestOrder({ data: { orderId: orderIdQuery!, email: trimmed } });
      setResumeOrder(order);
      setResumeOrderLoaded(true);
      if (order.payment_method === "gcash" && order.payment_status === "pending" && order.status === "pending") {
        setPaymentMethod("gcash");
        setOrderId(order.id);
        setDisplayOrderId(resolveDisplayOrderId(order));
        setStep(3);
      } else {
        setResumeError("This order isn't ready to resume. Check your order history.");
      }
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Unable to resume this order.");
    } finally {
      setGuestResumeLoading(false);
    }
  };

  // While logged in, wait for the profile's email_verified flag before
  // rendering anything — otherwise the unverified gate would flash (or stick,
  // if the profile fetch fails) on every reload.
  if (checkingAuth || (isAuthenticated && isVerified === null) || (orderIdQuery && !resumeOrderLoaded && isAuthenticated)) {
    return (
      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="rounded-3xl bg-card p-12 shadow-soft flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-foreground/75 font-medium">Verifying your account...</p>
          </div>
        </div>
      </section>
    );
  }

  if (authError) {
    return (
      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="rounded-3xl bg-card p-12 shadow-soft space-y-4">
            <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{authError}</div>
            <button type="button" onClick={() => window.location.reload()} className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-bounce-hover shadow-soft">
              Refresh Page
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Guest checkout is allowed — no auth gate here.

  // Guest resume: an orderId query with no account needs the checkout email.
  if (orderIdQuery && !isAuthenticated && !resumeOrder) {
    return (
      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="rounded-3xl bg-card p-12 shadow-soft space-y-5">
            <h1 className="font-display text-2xl text-brown">Resume your order</h1>
            <p className="text-sm text-foreground/75 max-w-md mx-auto">
              Enter the email you used at checkout to load your order.
            </p>
            <div className="space-y-2.5 text-left max-w-sm mx-auto">
              <input
                type="email"
                value={guestResumeEmail}
                onChange={(e) => setGuestResumeEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGuestResume(); }}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {resumeError && <p className="text-xs font-medium text-red-500">{resumeError}</p>}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleGuestResume}
                disabled={guestResumeLoading}
                className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-bounce-hover shadow-soft disabled:opacity-50"
              >
                {guestResumeLoading ? "Loading..." : "Load Order"}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/checkout", search: { orderId: undefined } })}
                className="inline-flex rounded-full px-5 py-3 text-sm font-medium text-foreground/70 hover:text-foreground"
              >
                Continue without resuming
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const canResumeOrder = Boolean(
    resumeOrder &&
    resumeOrder.payment_method === "gcash" &&
    resumeOrder.payment_status === "pending" &&
    resumeOrder.status === "pending",
  );

  // Email verification check: only applies to authenticated users.
  // Guests don't have profiles, so skip this gate entirely for them.
  if (isAuthenticated && isVerified === false) {
    return (
      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="rounded-3xl bg-card p-12 shadow-soft space-y-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h1 className="font-display text-3xl text-brown">Email Verification Required</h1>
              <p className="mt-3 text-foreground/75 max-w-md mx-auto">Please verify your email before placing an order.</p>
            </div>
            <button type="button" onClick={() => navigate({ to: "/shop" })} className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-bounce-hover shadow-soft">Return to Shop</button>
          </div>
        </div>
      </section>
    );
  }

  if (hasActiveOrder && !canResumeOrder) {
    return (
      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="rounded-3xl bg-card p-12 shadow-soft space-y-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h1 className="font-display text-3xl text-brown">Active Order In Progress</h1>
              <p className="mt-3 text-foreground/75 max-w-md mx-auto">You already have an active order (ID: <strong className="font-mono text-xs">{activeOrderId?.slice(0, 8)}</strong>). You can place a new order once your current order is completed or cancelled.</p>
            </div>
            <button type="button" onClick={() => navigate({ to: "/shop" })} className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-bounce-hover shadow-soft">Return to Shop</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-cream py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid gap-8 ${step === 4 ? "lg:grid-cols-1" : "lg:grid-cols-[1.4fr_0.9fr]"}`}>
          <div className="space-y-6 rounded-3xl bg-card p-8 shadow-soft">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs font-medium text-foreground/50 mb-2">
              {([1, 2, 3] as const).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold transition-colors ${
                    step === s ? "bg-wine text-white" : step > s ? "bg-sage text-white" : "bg-muted text-foreground/50"
                  }`}>
                    {step > s ? <CheckCircle className="w-3.5 h-3.5" /> : s}
                  </span>
                  <span className={step === s ? "text-foreground" : ""}>
                    {s === 1 ? "Shipping" : s === 2 ? "Payment" : "Confirm"}
                  </span>
                  {s < 3 && <span className="w-6 h-px bg-border mx-1" />}
                </span>
              ))}
            </div>

            {/* Guest checkout banner */}
            {!isAuthenticated && (
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm text-foreground/80 flex items-center justify-between gap-4">
                <p>
                  <span className="font-semibold">Have an account?</span>{" "}
                  <span className="text-foreground/60">Log in for faster checkout and order history.</span>
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/login", search: { redirect: "/checkout" } })}
                  className="shrink-0 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground btn-bounce-hover hover:bg-primary/90"
                >
                  Log in
                </button>
              </div>
            )}

            {/* Step 1: Shipping form */}
            {step === 1 && (
              <>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Checkout</span>
                  <h1 className="mt-3 font-display text-4xl text-brown">Shipping details</h1>
                  <p className="mt-1 text-foreground/75 text-sm">Enter your shipping address to continue.</p>
                </div>
                {formErrors.general ? <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{formErrors.general}</div> : null}
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-foreground">
                    <span>Name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-[var(--radius)] border border-border bg-background px-4 py-3 outline-none" />
                    {formErrors.name ? <p className="text-xs text-red-400">{formErrors.name}</p> : null}
                  </label>
                  <label className="space-y-2 text-sm text-foreground">
                    <span>Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-[var(--radius)] border border-border bg-background px-4 py-3 outline-none" />
                    {formErrors.email ? <p className="text-xs text-red-400">{formErrors.email}</p> : null}
                  </label>
                </div>
                <label className="space-y-2 text-sm text-foreground">
                  <span>Street address</span>
                  <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full rounded-[var(--radius)] border border-border bg-background px-4 py-3 outline-none" />
                  {formErrors.street ? <p className="text-xs text-red-400">{formErrors.street}</p> : null}
                </label>
                <div className="grid gap-6 sm:grid-cols-3">
                  <label className="space-y-2 text-sm text-foreground">
                    <span>City</span>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-[var(--radius)] border border-border bg-background px-4 py-3 outline-none" />
                    {formErrors.city ? <p className="text-xs text-red-400">{formErrors.city}</p> : null}
                  </label>
                  <label className="space-y-2 text-sm text-foreground">
                    <span>Province</span>
                    <input type="text" value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-[var(--radius)] border border-border bg-background px-4 py-3 outline-none" />
                    {formErrors.province ? <p className="text-xs text-red-400">{formErrors.province}</p> : null}
                  </label>
                  <label className="space-y-2 text-sm text-foreground">
                    <span>Postal code</span>
                    <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} className="w-full rounded-[var(--radius)] border border-border bg-background px-4 py-3 outline-none" />
                    {formErrors.zip ? <p className="text-xs text-red-400">{formErrors.zip}</p> : null}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormErrors({});
                    const result = step1Schema.safeParse({ name, email, street, city, province, zip });
                    if (!result.success) {
                      const newErrors: Record<string, string> = {};
                      for (const issue of result.error.issues) {
                        newErrors[issue.path[0] as string] = issue.message;
                      }
                      setFormErrors(newErrors);
                      return;
                    }
                    setStep(2);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft btn-bounce-hover hover:bg-primary/90"
                >
                  Continue to Payment
                </button>
              </>
            )}

            {/* Step 2: Payment method selection */}
            {step === 2 && (
              <>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Checkout</span>
                  <h1 className="mt-3 font-display text-4xl text-brown">Payment method</h1>
                  
                </div>
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("gcash")}
                    className={`w-full text-left rounded-2xl border-2 p-5 transition-all flex items-center justify-between ${
                      paymentMethod === "gcash" ? "border-sage bg-sage/5" : "border-border bg-background hover:border-sage/50"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">GCash</p>
                      <p className="text-sm text-foreground/70 mt-1">Pay via GCash and upload payment proof</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 grid place-items-center ${
                      paymentMethod === "gcash" ? "border-sage bg-white" : "border-border bg-white"
                    }`}>
                      {paymentMethod === "gcash" && <div className="w-2.5 h-2.5 rounded-full bg-sage" />}
                    </div>
                  </button>
                </div>
                <div className="rounded-3xl border border-border bg-background p-5 text-sm text-foreground/75">
                  Hello! 😊 Thank you for your interest. We'd just like to let you know that, for now, our only available payment method is <strong>GCash</strong>. We appreciate your understanding. We hope to offer additional payment options in the future to make transactions more convenient. Thank you for your support!
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground btn-bounce-hover shadow-soft"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setStep2Checking(true);
                      try {
                        const parsed = await validateCheckout();
                        if (!parsed) return;
                        // No order is created here — the customer confirms on
                        // the review step. Reloading before that point leaves
                        // no order behind.
                        setStep(3);
                      } finally {
                        setStep2Checking(false);
                      }
                    }}
                    disabled={step2Checking}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft btn-bounce-hover hover:bg-primary/90 disabled:opacity-50"
                  >
                    {step2Checking ? "Checking..." : "Continue to Review"}
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Review & confirm */}
            {step === 3 && paymentMethod === "cash_on_delivery" && (
              <>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Review</span>
                  <h1 className="mt-3 font-display text-4xl text-brown">Confirm your order</h1>
                  <p className="mt-1 text-foreground/75 text-sm">Review your details, then confirm to place your order.</p>
                </div>
                {formErrors.general ? <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{formErrors.general}</div> : null}
                <div className="rounded-2xl bg-background border border-border p-6 space-y-2 text-sm">
                  <p><span className="text-foreground/50">Ship to: </span>{name}, {street}, {city}, {province} {zip}</p>
                  <p><span className="text-foreground/50">Contact: </span>{email}</p>
                  <p><span className="text-foreground/50">Payment: </span>Cash on Delivery</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground btn-bounce-hover shadow-soft"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCodOrder}
                    disabled={createOrderMutation.isPending}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-wine px-5 py-3 text-sm font-semibold text-white shadow-soft btn-bounce-hover hover:bg-wine/90 disabled:opacity-50"
                  >
                    {createOrderMutation.isPending ? "Placing order..." : "Confirm Order"}
                  </button>
                </div>
              </>
            )}

            {step === 3 && paymentMethod === "gcash" && (
              <>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">GCash Payment</span>
                  <h1 className="mt-3 font-display text-3xl text-brown">Pay via GCash</h1>
                  <p className="mt-1 text-foreground/75 text-sm">Send payment to the GCash account below, then submit your proof to place your order.</p>
                </div>

                {formErrors.general ? <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{formErrors.general}</div> : null}

                {/* GCash Payment Details */}
                <div className="rounded-2xl bg-background border border-border p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="w-40 h-40 bg-blush rounded-xl flex items-center justify-center border-2 border-dashed border-wine/30 shrink-0">
                      <img
                        src={gcashConfig.qrCodeSrc}
                        alt="GCash QR Code"
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-xs text-wine/60 text-center px-2">QR code placeholder — replace with your actual GCash QR image</span>';
                        }}
                      />
                    </div>
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-xs text-foreground/50 uppercase tracking-wide">GCash Number</p>
                        <p className="text-lg font-bold text-wine">{gcashConfig.number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 uppercase tracking-wide">Account Name</p>
                        <p className="font-semibold">{gcashConfig.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 uppercase tracking-wide">Amount to Pay</p>
                        <p className="text-2xl font-bold text-foreground">{formatPrice(totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 uppercase tracking-wide">Order ID</p>
                        {displayOrderId ? (
                          <div className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-wine/40 bg-blush px-3 py-2">
                            <code className="font-mono text-base font-bold tracking-tight text-wine">{displayOrderId}</code>
                            <button
                              type="button"
                              onClick={handleCopyOrderId}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-wine hover:underline"
                            >
                              {copied ? "Copied!" : <><Copy className="w-3 h-3" /> Copy</>}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 rounded-xl border border-dashed border-wine/40 bg-blush px-3 py-2">
                            <p className="text-sm font-medium text-wine/80">Generated when you submit your proof below.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">📌 Important Instructions:</p>
                    <p>1. Open your GCash app and send the exact amount shown above.</p>
                    <p>2. Take a screenshot of the confirmation screen.</p>
                    <p>3. Fill in the reference number and upload the screenshot below. Your order is placed once you submit.</p>
                  </div>
                </div>

                {/* Proof Submission Form */}
                <div className="rounded-2xl bg-background border border-border p-6 space-y-5">
                  <h2 className="font-semibold text-foreground">Submit Payment Proof</h2>

                  <label className="space-y-2 text-sm text-foreground">
                    <span>GCash Reference Number <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      value={gcashRefNo}
                      onChange={(e) => { setGcashRefNo(e.target.value); setRefError(null); }}
                      placeholder="e.g. MFJX9K8L7R"
                      className="w-full rounded-[var(--radius)] border border-border bg-white px-4 py-3 outline-none font-mono text-sm"
                    />
                    {refError ? <p className="text-xs text-red-400">{refError}</p> : null}
                  </label>

                  <label className="space-y-2 text-sm text-foreground">
                    <span>Your Email <span className="text-red-500">*</span></span>
                    <input
                      type="email"
                      value={gcashEmail}
                      onChange={(e) => setGcashEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full rounded-[var(--radius)] border border-border bg-white px-4 py-3 outline-none"
                    />
                    {formErrors.gcashEmail ? <p className="text-xs text-red-400">{formErrors.gcashEmail}</p> : null}
                    {gcashEmailMismatch && !formErrors.gcashEmail ? <p className="text-xs text-red-400">This doesn&apos;t match the email on your shipping details.</p> : null}
                  </label>

                  <label className="space-y-2 text-sm text-foreground">
                    <span>Screenshot of Payment <span className="text-red-500">*</span></span>
                    <div className="mt-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {screenshotPreview ? (
                        <div className="relative inline-block">
                          <img src={screenshotPreview} alt="Screenshot preview" className="max-h-48 rounded-lg border border-border" />
                          <button
                            type="button"
                            onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs grid place-items-center hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 w-full rounded-[var(--radius)] border-2 border-dashed border-border bg-white px-4 py-8 text-sm text-foreground/60 hover:border-wine/50 hover:text-wine transition-colors"
                        >
                          <Upload className="w-5 h-5" />
                          Click to upload screenshot
                        </button>
                      )}
                      {formErrors.screenshot ? <p className="text-xs text-red-400 mt-1">{formErrors.screenshot}</p> : null}
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground btn-bounce-hover shadow-soft"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitProof}
                    disabled={submitProofMutation.isPending || uploadMutation.isPending || !gcashEmail.trim() || gcashEmailMismatch}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-wine px-5 py-3 text-sm font-semibold text-white shadow-soft btn-bounce-hover hover:bg-wine/90 disabled:opacity-50"
                  >
                    {submitProofMutation.isPending || uploadMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                    ) : (
                      "Submit Payment Proof"
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="text-center py-8">
                <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-sage/20 text-sage-deep mb-6">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h1 className="font-display text-3xl text-brown mb-3">
                  {paymentMethod === "gcash" ? "Proof Submitted!" : "Order Confirmed!"}
                </h1>
                {orderId && displayOrderId && (
                  <p className="text-sm text-foreground/60 mb-2">
                    Order ID:{" "}
                    <Link
                      to="/orders"
                      search={isAuthenticated ? undefined : { email }}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {displayOrderId}
                    </Link>
                  </p>
                )}
                <p className="text-foreground/75 max-w-md mx-auto mb-6 text-sm">
                  {successMessage}
                </p>
                {!isAuthenticated && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 max-w-md mx-auto mb-6 text-left">
                    <p className="font-semibold mb-1">Save your order ID!</p>
                    <p>
                      You don&apos;t have an account, so we can&apos;t show you order history.
                      Save your Order ID <code className="font-mono font-semibold">{displayOrderId}</code> to track or inquire about your order.
                    </p>
                  </div>
                )}
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => { clearCheckoutDraft(); navigate({ to: "/shop" }); }}
                    className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground btn-bounce-hover shadow-soft"
                  >
                    Continue Shopping
                  </button>
                  <button
                    type="button"
                    onClick={() => { clearCheckoutDraft(); navigate({ to: "/" }); }}
                    className="inline-flex rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground btn-bounce-hover shadow-soft"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar — hidden on the confirmation step */}
          {step !== 4 && (
          <aside className="space-y-6 rounded-3xl bg-card p-6 shadow-soft self-start">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/70">Order summary</p>
              <div className="mt-5 space-y-3 text-sm text-foreground">
                  <div className="flex items-center justify-between">
                    <span>{itemCount} items</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shipping</span>
                    <span>{formatPrice(shippingFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tax</span>
                    <span>{formatPrice(taxAmount)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-5 text-lg font-semibold text-foreground">
                <span>Total</span>
                <span>{formatPrice(totalAmount)}</span>
            </div>
            <div className="rounded-3xl bg-background p-5 text-sm text-foreground/80">
              <p className="font-semibold">
                {paymentMethod === "gcash" ? "Pay via GCash." : "Payment is handled at delivery."}
              </p>
              <p className="mt-2">
                {paymentMethod === "gcash"
                  ? "Send the exact amount to the GCash account shown, then upload your proof."
                  : "You'll pay in cash when your order arrives."}
              </p>
            </div>
            <div className="rounded-3xl bg-background p-5 text-sm text-foreground/80">
              <p className="font-semibold">Need to change your cart?</p>
              <button type="button" onClick={() => navigate({ to: "/cart" })} className="mt-3 inline-flex rounded-full bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
                Edit cart
              </button>
            </div>
          </aside>
          )}
        </div>
      </div>
    </section>
  );
}
