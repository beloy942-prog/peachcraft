import { Link } from "@tanstack/react-router";
import { Instagram, Music2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { subscribeNewsletter } from "@/lib/api/newsletter.functions";

const regionOptions = [
  { value: "ph", label: "Philippines (PHP ₱)", code: "PHP", symbol: "₱", locale: "en-PH" },
  { value: "us", label: "United States (USD $)", code: "USD", symbol: "$", locale: "en-US" },
  { value: "sg", label: "Singapore (SGD S$)", code: "SGD", symbol: "S$", locale: "en-SG" },
  { value: "au", label: "Australia (AUD A$)", code: "AUD", symbol: "A$", locale: "en-AU" },
];

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(regionOptions[0]);

  const handleRegionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextRegion = regionOptions.find((option) => option.value === event.target.value) ?? regionOptions[0];
    setSelectedRegion(nextRegion);
  };

  return (
    <footer className="bg-sage-deep text-background mt-0 border-t border-white/10">
      <div className={"max-w-7xl mx-auto px-4 sm:px-6 grid gap-12 lg:grid-cols-[1.2fr_1fr_1.2fr] " + (compact ? "py-6" : "py-16")}>
        {/* Column 1: Brand & Socials */}
        <div className="space-y-6">
          <div className="font-display text-3xl font-bold tracking-tight">
            <span>Peach</span> <span className="text-blush">Craft</span>
          </div>
          <p className="text-background/80 text-sm max-w-sm leading-relaxed">
            Handmade fake cakes, storage boxes &amp; clay crafts — made with love, one piece at a time. Crafted to look good and actually be useful. 🍑
          </p>
          <div className="flex gap-3">
            {[
              {
                Icon: Instagram,
                label: "Instagram",
                href: "https://www.instagram.com/_peachcraft?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
              },
              {
                Icon: Music2,
                label: "TikTok",
                href: "https://www.tiktok.com/@thepeachywitch?is_from_webapp=1&sender_device=pc",
              },
              { Icon: Mail, label: "Email us", href: "mailto:hello@peachcraft.shop" },
            ].map(({ Icon, label, href }) => {
              const external = href?.startsWith("http");
              return (
                <a
                  key={label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  aria-label={label}
                  className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-blush hover:text-blush-foreground transition-all duration-300 btn-bounce-hover"
                >
                  <Icon className="w-4 h-4" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Column 2: Link Groups */}
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <h3 className="font-display text-base font-semibold text-background mb-4">Shop</h3>
            <ul className="space-y-3 text-background/75 font-medium">
              <li><Link to="/shop" className="hover:text-blush transition-colors">All Crafts</Link></li>
              <li><Link to="/about" className="hover:text-blush transition-colors">Our Story</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-background mb-4">Support</h3>
            <ul className="space-y-3 text-background/75 font-medium">
              <li><Link to="/shipping-policy" className="hover:text-blush transition-colors">Shipping Policy</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-blush transition-colors">Refund Policy</Link></li>
              <li><Link to="/contact" className="hover:text-blush transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>

        {/* Column 3: Newsletter Sign-up */}
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 lg:p-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blush" aria-hidden /> New drops monthly
          </div>
          <h3 className="font-display text-2xl text-background">
            Keep in contact for FRESH crafts!
          </h3>
          <p className="text-background/75 text-xs max-w-sm leading-relaxed">
            Be the first to grab restocks and limited pieces before they sell out.
          </p>
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              if (submitting) return;
              const trimmed = email.trim();
              // UX-only pre-check; zod on the server function is the real gate.
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                toast.error("Please enter a valid email address.");
                return;
              }
              setSubmitting(true);
              try {
                const result = await subscribeNewsletter({ data: { email: trimmed } });
                setDone(true);
                setEmail("");
                toast.success(result.message);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex flex-col gap-2 pt-2"
          >
            <label htmlFor="newsletter" className="sr-only">Email address</label>
            <div className="flex gap-2 bg-white/10 border border-white/20 rounded-full p-1.5 focus-within:ring-2 focus-within:ring-blush">
              <input
                id="newsletter"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="flex-1 bg-transparent px-3 text-sm text-background placeholder:text-background/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-full bg-blush text-blush-foreground font-semibold text-xs transition-all btn-bounce-hover shadow-soft whitespace-nowrap disabled:opacity-60"
              >
                {submitting ? "Joining..." : done ? "You're in! 🍑" : "Join"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 bg-black/5">
        <div className={"max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-background/65 " + (compact ? "py-3" : "py-6")}>
          <p>© 2026 Peach Craft. All rights reserved. Made with 🍑 &amp; love.</p>
          <div className="flex gap-6 font-medium">
            <Link to="/shipping-policy" className="hover:text-blush transition-colors">Shipping Policy</Link>
            <Link to="/shipping-policy" className="hover:text-blush transition-colors">Refund Policy</Link>
            <Link to="/contact" className="hover:text-blush transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
