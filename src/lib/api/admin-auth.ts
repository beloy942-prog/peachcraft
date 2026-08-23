import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from "@/lib/supabase";

function autoDetectRequest(): Request | undefined {
  try {
    const storageKey = Symbol.for("tanstack-start:start-storage-context");
    const storage = (globalThis as any)[storageKey];
    if (storage) {
      const ctx = storage.getStore();
      if (ctx?.request) return ctx.request;
    }
  } catch {}
}

function parseCookies(cookieHeader: string) {
  if (!cookieHeader) return [];
  return cookieHeader.split("; ").filter(Boolean).map((c) => {
    const eq = c.indexOf("=");
    if (eq === -1) return { name: c.trim(), value: "" };
    return { name: c.slice(0, eq).trim(), value: c.slice(eq + 1).trim() };
  });
}

export async function verifyAdmin(request?: Request, accessToken?: string) {
  let user = null;
  let error: any = null;

  // 1. Prefer explicitly-passed accessToken (most callers that already have it)
  if (accessToken) {
    const supabase = getSupabaseServer(request, { authOnly: true });
    const tokenResult = await (supabase.auth as any).getUser(accessToken);
    user = tokenResult?.data?.user ?? null;
    error = tokenResult?.error ?? null;
  } else {
    // 2. Try to auto-detect the request and read the sb-admin-token cookie
    //    (set by the browser login page since the Supabase client uses localStorage,
    //    not HTTP cookies, so the old createServerClient cookie path was always empty).
    const req = request ?? autoDetectRequest();
    if (req) {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const tokenFromCookie = parseCookies(cookieHeader)
        .find((c) => c.name === "sb-admin-token")?.value;

      if (tokenFromCookie) {
        const supabaseUrl = process.env.SUPABASE_URL ?? "";
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        });
        const tokenResult = await supabase.auth.getUser(tokenFromCookie);
        user = tokenResult.data?.user ?? null;
        error = tokenResult.error ?? null;
      } else {
        // 3. Last resort: cookie-based getUser (legacy path; rarely works with localStorage client)
        const supabaseUrl = process.env.SUPABASE_URL ?? "";
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return parseCookies(req.headers.get("cookie") ?? "");
            },
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        });

        const result = await supabase.auth.getUser();
        user = result.data?.user ?? null;
        error = result.error;
      }
    } else {
      throw new Error("Unauthorized");
    }
  }

  if (error || !user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error("Unauthorized");
  }

  return user;
}

function getMagicBytes(buffer: { subarray(start: number, end: number): Uint8Array }) {
  return buffer.subarray(0, 12);
}

export function validateImageBuffer(
  buffer: { length: number; subarray(start: number, end: number): Uint8Array },
  maxFileSizeBytes = 5 * 1024 * 1024,
) {
  if (buffer.length > maxFileSizeBytes) {
    const maxMb = Math.round(maxFileSizeBytes / 1024 / 1024);
    throw new Error(`File too large. Maximum size is ${maxMb}MB.`);
  }

  if (buffer.length < 4) {
    throw new Error("File is empty or too small to be a valid image.");
  }

  const magic = getMagicBytes(buffer);
  const isValidImage =
    (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) ||
    (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47 && magic[4] === 0x0D && magic[5] === 0x0A && magic[6] === 0x1A && magic[7] === 0x0A) ||
    (magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46 && magic[8] === 0x57 && magic[9] === 0x45 && magic[10] === 0x42 && magic[11] === 0x50) ||
    (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x38 && (magic[4] === 0x37 || magic[4] === 0x39) && magic[5] === 0x61);

  if (!isValidImage) {
    throw new Error("Invalid image file. Only JPEG, PNG, WebP, and GIF images are allowed.");
  }
}
