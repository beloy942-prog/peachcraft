import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getStoreDetails, uploadStoreImage, updateStoreDetails } from "@/lib/api/storeDetails.functions";

export const Route = createFileRoute("/admin/website-settings")({
  component: WebsiteSettings,
});

function WebsiteSettings() {
  const [initial, setInitial] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    store_name: "",
    store_logo: null,
    store_description: "",
    contact_email: "",
    contact_number: "",
    address: "",
    tiktok_url: "",
    instagram_url: "",
    footer_text: "",
    hero_banner: null,
    gcash_number: "",
    gcash_account_name: "",
    gcash_qr: null,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getStoreDetails();
      if (!mounted) return;
      if (data) {
        setInitial(data);
        setForm({
          store_name: data.store_name ?? "",
          store_logo: data.store_logo ?? null,
          store_description: data.store_description ?? "",
          contact_email: data.contact_email ?? "",
          contact_number: data.contact_number ?? "",
          address: data.address ?? "",
          tiktok_url: data.tiktok_url ?? "",
          instagram_url: data.instagram_url ?? "",
          footer_text: data.footer_text ?? "",
          hero_banner: data.hero_banner ?? null,
          gcash_number: data.gcash_number ?? "",
          gcash_account_name: data.gcash_account_name ?? "",
          gcash_qr: data.gcash_qr ?? null,
        });
        setLogoPreview(data.store_logo ?? null);
        setBannerPreview(data.hero_banner ?? null);
        setQrPreview(data.gcash_qr ?? null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void, setPreview: (p: string | null) => void) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return setFile(null);
    const valid = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type);
    if (!valid) {
      setMessage({ type: "error", text: "Invalid image type. Use jpg, jpeg, png, webp." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image too large. Max 5MB." });
      return;
    }
    setFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  const getAccessToken = async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  async function toBase64(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSave() {
    setMessage(null);
    if (!form.store_name || !form.contact_number) {
      setMessage({ type: "error", text: "Store name and contact number are required." });
      return;
    }
    if (form.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contact_email)) {
      setMessage({ type: "error", text: "Invalid email address." });
      return;
    }

    setLoading(true);
    try {
      let storeLogoUrl = form.store_logo;
      let heroBannerUrl = form.hero_banner;
      let gcashQrUrl = form.gcash_qr;

      const accessToken = await getAccessToken();

      if (logoFile) {
        const base64 = await toBase64(logoFile);
        const uploaded = await uploadStoreImage({ data: { fileName: logoFile.name, base64, accessToken } });
        storeLogoUrl = uploaded.publicUrl;
      }

      if (bannerFile) {
        const base64 = await toBase64(bannerFile);
        const uploaded = await uploadStoreImage({ data: { fileName: bannerFile.name, base64, accessToken } });
        heroBannerUrl = uploaded.publicUrl;
      }

      if (qrFile) {
        const base64 = await toBase64(qrFile);
        const uploaded = await uploadStoreImage({ data: { fileName: qrFile.name, base64, accessToken } });
        gcashQrUrl = uploaded.publicUrl;
      }

      const payload = {
        store_name: form.store_name,
        store_logo: storeLogoUrl ?? null,
        store_description: form.store_description ?? null,
        contact_email: form.contact_email ?? null,
        contact_number: form.contact_number,
        address: form.address ?? null,
        tiktok_url: form.tiktok_url ?? null,
        instagram_url: form.instagram_url ?? null,
        footer_text: form.footer_text ?? null,
        hero_banner: heroBannerUrl ?? null,
        gcash_number: form.gcash_number ?? null,
        gcash_account_name: form.gcash_account_name ?? null,
        gcash_qr: gcashQrUrl ?? null,
        accessToken,
      };

      await updateStoreDetails({ data: payload });
      setMessage({ type: "success", text: "Settings saved." });
      // Refresh initial state
      const refreshed = await getStoreDetails();
      setInitial(refreshed);
      setForm({
        store_name: refreshed?.store_name ?? "",
        store_logo: refreshed?.store_logo ?? null,
        store_description: refreshed?.store_description ?? "",
        contact_email: refreshed?.contact_email ?? "",
        contact_number: refreshed?.contact_number ?? "",
        address: refreshed?.address ?? "",
        tiktok_url: refreshed?.tiktok_url ?? "",
        instagram_url: refreshed?.instagram_url ?? "",
        footer_text: refreshed?.footer_text ?? "",
        hero_banner: refreshed?.hero_banner ?? null,
        gcash_number: refreshed?.gcash_number ?? "",
        gcash_account_name: refreshed?.gcash_account_name ?? "",
        gcash_qr: refreshed?.gcash_qr ?? null,
      });
      setLogoFile(null);
      setBannerFile(null);
      setQrFile(null);
      setLogoPreview(refreshed?.store_logo ?? null);
      setBannerPreview(refreshed?.hero_banner ?? null);
      setQrPreview(refreshed?.gcash_qr ?? null);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? "Failed to save settings." });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    if (!initial) return;
    if (!window.confirm("Reset all changes to the last saved state?")) return;
    setForm({
      store_name: initial.store_name ?? "",
      store_logo: initial.store_logo ?? null,
      store_description: initial.store_description ?? "",
      contact_email: initial.contact_email ?? "",
      contact_number: initial.contact_number ?? "",
      address: initial.address ?? "",
      tiktok_url: initial.tiktok_url ?? "",
      instagram_url: initial.instagram_url ?? "",
      footer_text: initial.footer_text ?? "",
      hero_banner: initial.hero_banner ?? null,
      gcash_number: initial.gcash_number ?? "",
      gcash_account_name: initial.gcash_account_name ?? "",
      gcash_qr: initial.gcash_qr ?? null,
    });
    setLogoFile(null);
    setBannerFile(null);
    setQrFile(null);
    setLogoPreview(initial.store_logo ?? null);
    setBannerPreview(initial.hero_banner ?? null);
    setQrPreview(initial.gcash_qr ?? null);
    setMessage(null);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Website Settings</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <div className="text-sm font-medium mb-2">Store Name *</div>
            <input
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-2">Store Description</div>
            <textarea
              rows={4}
              value={form.store_description}
              onChange={(e) => setForm({ ...form, store_description: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-2">Contact Email</div>
            <input
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
              type="email"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-2">Contact Number *</div>
            <input
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-2">GCash Number</div>
            <input
              value={form.gcash_number}
              onChange={(e) => setForm({ ...form, gcash_number: e.target.value })}
              placeholder="e.g. 0917 123 4567"
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-2">GCash Account Name</div>
            <input
              value={form.gcash_account_name}
              onChange={(e) => setForm({ ...form, gcash_account_name: e.target.value })}
              placeholder="e.g. Peach Craft PH"
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium mb-2">Business Address</div>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-medium mb-2">TikTok URL</div>
              <input
                value={form.tiktok_url}
                onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium mb-2">Instagram URL</div>
              <input
                value={form.instagram_url}
                onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium mb-2">Footer Copyright Text</div>
            <input
              value={form.footer_text}
              onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Store Logo</div>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-full max-w-[160px] h-24 bg-white/5 rounded-md flex items-center justify-center border">
                {logoPreview ? <img src={logoPreview} alt="logo preview" className="max-w-full max-h-full object-contain" /> : <span className="text-sm text-muted">No logo</span>}
              </div>
              <div>
                <label className="inline-block cursor-pointer rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-soft underline decoration-transparent transition-colors duration-200 hover:bg-muted/90 hover:decoration-foreground/60">
                  Choose file
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setLogoFile, setLogoPreview)} className="sr-only" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Hero Banner</div>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-full max-w-[256px] h-36 bg-white/5 rounded-md flex items-center justify-center border">
                {bannerPreview ? <img src={bannerPreview} alt="banner preview" className="w-full h-full object-cover rounded-md" /> : <span className="text-sm text-muted">No banner</span>}
              </div>
              <div>
                <label className="inline-block cursor-pointer rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-soft underline decoration-transparent transition-colors duration-200 hover:bg-muted/90 hover:decoration-foreground/60">
                  Choose file
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setBannerFile, setBannerPreview)} className="sr-only" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">GCash QR Code</div>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-full max-w-[160px] h-24 bg-white/5 rounded-md flex items-center justify-center border">
                {qrPreview ? <img src={qrPreview} alt="gcash qr preview" className="max-w-full max-h-full object-contain" /> : <span className="text-sm text-muted">No QR</span>}
              </div>
              <div>
                <label className="inline-block cursor-pointer rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-soft underline decoration-transparent transition-colors duration-200 hover:bg-muted/90 hover:decoration-foreground/60">
                  Choose file
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setQrFile, setQrPreview)} className="sr-only" />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Preview Text</div>
            <div className="rounded-md border p-3 bg-white/5 min-h-[120px]">
              <p className="font-semibold">{form.store_name || "Store name"}</p>
              <p className="text-sm text-muted">{form.store_description || "Store description"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-full bg-blush text-blush-foreground font-semibold transition hover:bg-blush/90">
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={handleReset} disabled={loading} className="px-4 py-2 rounded-full bg-muted text-muted-foreground font-semibold transition hover:bg-muted/90">
              Reset
            </button>
          </div>

          {message && (
            <div className={"mt-3 p-3 rounded-md " + (message.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white")}>{message.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
