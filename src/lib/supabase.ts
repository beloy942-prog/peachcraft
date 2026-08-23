import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clear auth-related cookies from the browser so the server's
 * createServerClient doesn't attempt a refresh with stale tokens.
 * Call after every sign-out or auth-failure catch handler.
 */
export function clearAuthCookies() {
  if (typeof document === "undefined") return;
  const prefixes = ["supabase-auth-token", "sb-"];
  document.cookie.split("; ").forEach((c) => {
    const eq = c.indexOf("=");
    const name = eq === -1 ? c.trim() : c.slice(0, eq).trim();
    if (prefixes.some((p) => name.startsWith(p))) {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    }
  });
}

const getClientEnv = () => {
  const url =
    import.meta.env.VITE_SUPABASE_URL ??
    (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined);

  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    (typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined);

  return { url, anonKey };
};

let serverSupabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getClientEnv();

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase client environment variables. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (for browser) or SUPABASE_URL / SUPABASE_ANON_KEY (for server-side usage).",
    );
  }

  if (typeof window !== "undefined") {
    // Browser: use createClient with localStorage (simpler than @supabase/ssr's createBrowserClient).
    // Store on window to prevent SSR module-scope leakage from Vinxi shared caching.
    if (!(window as any).__peachcraft_supabase) {
      // Before creating the client, strip any stale sessions from localStorage whose
      // access_token has expired (or is within the 90-second refresh margin). This
      // prevents the client's _recoverAndRefresh from attempting a token refresh
      // with an invalidated refresh token — a request that can hang indefinitely
      // (e.g. browser extension blocking the Supabase API, corporate proxy, etc.)
      // and block initializePromise, which in turn hangs every auth method.
      const MARGIN_S = 90;
      const now = Math.floor(Date.now() / 1000);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.startsWith("supabase-"))) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              const expiresAt = parsed?.expires_at ?? parsed?.currentSession?.expires_at;
              if (typeof expiresAt === "number" && expiresAt + MARGIN_S < now) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Non-JSON or unrecognised format — leave it alone
          }
        }
      }

      (window as any).__peachcraft_supabase = createClient(url, anonKey, {
        auth: {
          flowType: "pkce",
          // autoRefreshToken disabled because the Supabase API's refresh endpoint
          // hangs indefinitely under certain network conditions (corporate proxy,
          // browser extension, TLS negotiation stall). When enabled, the client's
          // internal _callRefreshToken blocks initializePromise forever, which in
          // turn hangs every auth method (getSession, getUser, signOut).
          autoRefreshToken: false,
          detectSessionInUrl: true,
          persistSession: true,
          storage: window.localStorage,
        },
      });
    }
    return (window as any).__peachcraft_supabase;
  }

  // Server: module-level cache (separate module graph from client bundle)
  if (!serverSupabaseClient) {
    serverSupabaseClient = createClient(url, anonKey);
  }
  return serverSupabaseClient;
}

export type Product = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  images?: string[] | null;
  soldOut?: boolean;
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

export type Profile = {
  id: string;
  username: string;
  email: string;
  address?: string | null;
  email_verified?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupabaseServerOptions = {
  authOnly?: boolean;
};

export function getSupabaseServer(request?: Request, options?: SupabaseServerOptions) {
  const SUPABASE_URL_SERVER = typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined;
  const SUPABASE_SERVICE_ROLE_KEY = typeof process !== "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
  const SUPABASE_ANON_KEY_SERVER = typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined;

  if (!SUPABASE_URL_SERVER) {
    throw new Error("Missing SUPABASE_URL environment variable on the server.");
  }

  const authOnly = options?.authOnly ?? false;
  const key = authOnly ? SUPABASE_ANON_KEY_SERVER : SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY_SERVER;

  if (!key) {
    throw new Error(
      authOnly
        ? "Missing Supabase anon server key. Set SUPABASE_ANON_KEY in your .env.local."
        : "Missing Supabase server key. Set SUPABASE_SERVICE_ROLE_KEY (admin) or SUPABASE_ANON_KEY in your .env.local."
    );
  }

  // Auto-detect the request from TanStack Start's AsyncLocalStorage context
  // when called inside a server function handler without an explicit request.
  if (!request) {
    try {
      const storageKey = Symbol.for("tanstack-start:start-storage-context");
      const storage = (globalThis as any)[storageKey];
      if (storage) {
        const ctx = storage.getStore();
        if (ctx?.request) {
          request = ctx.request;
        }
      }
    } catch {
      // Not running inside a TanStack Start request context
    }
  }

  // Auth-only client: use createClient (not createServerClient) so we NEVER
  // touch cookies. This avoids the _emitInitialSession → stale-cookie-refresh
  // → refresh_token_not_found error loop.  All callers provide the access
  // token explicitly via getUser(jwt); the cookie-based getUser() fallback is
  // omitted.
  if (authOnly) {
    return createClient(SUPABASE_URL_SERVER, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return createClient(SUPABASE_URL_SERVER, key);
}

export async function seedProductsFromStatic(products: Product[]) {
  // Run once then delete.
  const supabase = getSupabaseServer();
  const mappedProducts = products.map((product) => ({
    name: product.name,
    price: product.price,
    description: product.description ?? null,
    images: product.images ?? [],
    swatch: product.swatch ?? null,
    category: product.category ?? null,
    tag: product.tag ?? null,
    stock_qty: product.soldOut ? 0 : product.stock_qty ?? 10,
    is_active: product.soldOut ? false : true,
  }));

  const { error } = await supabase.from("products").insert(mappedProducts);
  if (error) {
    throw error;
  }

  return { inserted: mappedProducts.length };
}