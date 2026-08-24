import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Mail, Instagram, Send, Music2, Phone } from "lucide-react";
import { toast } from "sonner";
import { getStoreDetails } from "@/lib/api/storeDetails.functions";
import { submitContactMessage } from "@/lib/api/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Peach Craft" },
      { name: "description", content: "Say hi, ask about custom orders, or get help with an existing order at Peach Craft." },
      { property: "og:title", content: "Contact Peach Craft" },
      { property: "og:description", content: "Say hi, ask about custom orders, or get help with an existing order." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [storeDetails, setStoreDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    // UX-only pre-checks; zod on the server function is the real gate.
    if (!name.trim() || !message.trim()) {
      toast.error("Please fill in your name and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitContactMessage({
        data: { name: name.trim(), email: email.trim(), message: message.trim() },
      });
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getStoreDetails();
        if (mounted) {
          setStoreDetails(data);
        }
      } catch (error) {
        console.error("Failed to fetch store details:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <section className="bg-cream py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_1.2fr] gap-10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Contact</span>
          <h1 className="mt-3 font-display text-5xl text-brown">Say hi</h1>
          <p className="mt-3 text-foreground/80 leading-relaxed">
            Custom order? Press inquiry? Just want to chat about clay? I'd love to hear from you. I reply within 1–2 business days.
          </p>
          <ul className="mt-6 space-y-3 text-foreground/80">
            <li className="flex items-center gap-3"><Mail className="w-5 h-5 text-primary" aria-hidden /> {storeDetails?.contact_email || "hello@peachcraft.shop"}</li>
            <li className="flex items-center gap-3"><Instagram className="w-5 h-5 text-primary" aria-hidden /> @peach.craft</li>
            <li className="flex items-center gap-3"><Music2 className="w-5 h-5 text-primary" aria-hidden /> @thepeachywitch</li>
            {storeDetails?.contact_number && (
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary" aria-hidden />
                <a href={`tel:${storeDetails.contact_number}`} className="hover:text-primary transition-colors">
                  {storeDetails.contact_number}
                </a>
              </li>
            )}
          </ul>
        </div>

        <form
          onSubmit={handleSend}
          className="bg-card rounded-3xl p-8 shadow-card space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-brown mb-1.5">Name</label>
            <input id="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-brown mb-1.5">Email</label>
            <input id="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label htmlFor="msg" className="block text-sm font-semibold text-brown mb-1.5">Message</label>
            <textarea id="msg" required rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-soft hover:-translate-y-0.5 transition-transform disabled:opacity-60"
          >
            {submitting ? <>Sending... <Send className="w-4 h-4 animate-pulse" /></> : sent ? "Sent! Talk soon" : <>Send message <Send className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </section>
  );
}
