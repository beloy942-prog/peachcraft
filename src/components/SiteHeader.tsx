import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, ShoppingBag, Menu, X, ArrowRight, Tag, Package, Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/icons/logo.svg?url";
import { clearAuthCookies, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getMyOrders } from "@/lib/api/supabase.functions";
import { getAutocompleteSuggestions } from "@/lib/api/search.functions";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCIES } from "@/lib/currency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AutocompleteSuggestions } from "@/lib/api/search.functions";

const nav = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "Our Story" },
  { to: "/shipping-policy", label: "FAQ" },
] as const;

/** Highlights the query string inside text using a styled <mark> span. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-primary/15 text-primary font-semibold rounded-sm px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function SiteHeader() {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestions>({
    products: [],
    categories: [],
    brands: [],
  });
  const { user: authUser, loading: authLoading } = useAuth();
  const { currency, setCurrency, formatPrice } = useCurrency();
  const { location } = useRouterState();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── Scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ─── Close mobile nav and search on route change ─────────────────────────
  useEffect(() => {
    setMobileOpen(false);
    closeSearch();
  }, [location.pathname]);

  // ─── Auth-driven order caching ───────────────────────────────────────────
  useEffect(() => {
    const { data: listener } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
      (async () => {
        try {
          if (session?.user) {
            const orders = await getMyOrders({ data: { accessToken: session.access_token } });
            if (orders && Array.isArray(orders)) {
              try {
                window.localStorage.setItem("peachcraft-orders", JSON.stringify(orders));
              } catch {}
            }
          } else {
            try {
              window.localStorage.removeItem("peachcraft-orders");
            } catch {}
          }
        } catch {
          // ignore
        }
      })();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (searchOpen) closeSearch();
        else openSearch();
      }
      if (e.key === "Escape" && searchOpen) {
        closeSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // ─── Click-outside to close dropdown ─────────────────────────────────────
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the dropdown or the search input area
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.closest("[data-search-bar]")?.contains(target)
      ) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // ─── Debounce query ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  // ─── Fetch suggestions ────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    if (!debouncedQuery.trim()) {
      setSuggestions({ products: [], categories: [], brands: [] });
      setIsLoadingSuggestions(false);
      return;
    }
    setIsLoadingSuggestions(true);
    getAutocompleteSuggestions({ data: { q: debouncedQuery } })
      .then((res) => {
        if (active) setSuggestions(res);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setIsLoadingSuggestions(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setSuggestions({ products: [], categories: [], brands: [] });
  }, []);

  const handleSignOut = () => {
    // 1. Clear local session FIRST — synchronously, before any network call.
    const prefixes = ["sb-", "supabase-"];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
    clearAuthCookies();
    // Clear the admin token cookie used by adminMiddleware
    document.cookie = "sb-admin-token=; path=/; max-age=0; SameSite=Lax";

    // 2. Fire best-effort server revocation — detached, no await, no timeout.
    //    The UI must never wait on this or change behavior based on its outcome.
    getSupabaseClient().auth.signOut().catch(() => {});

    // 3. Discard the cached client so the next getSupabaseClient() call
    //    constructs a fresh instance with a fresh internal lock — guaranteeing
    //    a zombie signOut() from a prior attempt can't poison a later session.
    delete (window as any).__peachcraft_supabase;

    // 4. Notify AuthProvider to sync its context (since the network signOut
    //    above may never resolve, we can't rely on onAuthStateChange).
    window.dispatchEvent(new Event("peachcraft-auth-cleared"));

    // 5. Navigate away. The user is logged out in the UI regardless of
    //    whether the server revocation call ever completes.
    navigate({ to: "/" });
  };

  const handleSearchSubmit = (q: string) => {
    if (!q.trim()) return;
    closeSearch();
    navigate({ to: "/search", search: { q: q.trim() } });
  };

  const handleSelectProduct = (id: string) => {
    closeSearch();
    navigate({ to: `/shop/${id}` });
  };

  const handleSelectSuggestion = (term: string) => {
    closeSearch();
    navigate({ to: "/search", search: { q: term } });
  };

  const { itemCount } = useCart();
  const prevItemCountRef = useRef(itemCount);
  const [cartBouncing, setCartBouncing] = useState(false);

  useEffect(() => {
    if (itemCount > prevItemCountRef.current) {
      setCartBouncing(true);
      setTimeout(() => setCartBouncing(false), 600);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount]);

  const userEmail = authUser?.email ?? null;
  const isLoggedIn = !!userEmail;

  const hasSuggestions =
    suggestions.products.length > 0 ||
    suggestions.categories.length > 0 ||
    suggestions.brands.length > 0;

  const showDropdown = searchOpen && query.trim().length > 0;

  return (
    <>

      <header
        className={cn(
          "fixed top-0 left-0 right-0 w-full z-50 bg-white text-gray-900 border-b border-gray-100 transition-all duration-300",
          compact ? "py-2 shadow-[0_4px_24px_rgba(0,0,0,0.08)]" : "py-5 shadow-none"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── SEARCH MODE ── */}
          {searchOpen ? (
              <div
                data-search-bar
                className="flex items-center gap-3 h-14 lg:h-16 animate-in fade-in slide-in-from-top-1 duration-200 bg-background rounded-xl px-3"
              >
              {/* Search icon (static) */}
              <Search className="w-5 h-5 text-foreground/50 shrink-0" aria-hidden />

              {/* Input */}
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit(query);
                }}
                placeholder="Search products, brands, or categories..."
                aria-label="Search Peach Craft"
                className="flex-1 bg-transparent border-none outline-none text-base font-medium text-foreground placeholder:text-foreground/40 caret-primary"
              />

              {/* Loading spinner */}
              {isLoadingSuggestions && (
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              )}

              {/* Clear / Close */}
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="grid place-items-center w-10 h-10 rounded-full text-foreground/60 hover:text-foreground hover:bg-accent transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            /* ── NORMAL MODE ── */
            <>
              {/* Mobile Navbar Placement: [Hamburger] - [Centered Logo] - [Search, Cart] */}
              <div className="flex items-center justify-between h-14 lg:hidden w-full px-1 sm:px-2">
                {/* Left: Hamburger */}
                <div className="flex justify-start shrink-0">
                  <button
                    type="button"
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileOpen}
                    onClick={() => setMobileOpen((v) => !v)}
                    className="text-gray-600 hover:text-blush transition-colors p-1"
                  >
                    {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
                </div>

                {/* Center: Logo (Flex-1 to prevent overlap) */}
                <div className="flex-1 flex justify-center items-center pointer-events-none min-w-0 mx-2">
                  <Link to="/" className="flex items-center gap-1.5 pointer-events-auto group whitespace-nowrap transition-all duration-300 min-w-0" aria-label="Peach Craft home" style={{ transform: `scale(${compact ? 1 : 1.15})`, transformOrigin: "center center" }}>
                    <img
                      src={logoUrl}
                      alt="Peach Craft logo"
                      className="w-8 h-8 object-contain transition-transform group-hover:rotate-12 duration-300 shrink-0"
                    />
                    <span className="font-display text-xl truncate">
                      <span className="text-gray-900">Peach</span>{" "}
                      <span className="text-blush font-bold">Craft</span>
                    </span>
                  </Link>
                </div>

                {/* Right: Search, Orders, Cart */}
                <div className="flex justify-end items-center gap-1 sm:gap-3 shrink-0">
                  {/* Search button */}
                  <button
                    type="button"
                    aria-label="Search"
                    onClick={openSearch}
                    className="text-gray-600 hover:text-blush transition-colors p-1"
                  >
                    <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>



                  {/* Cart */}
                  <Link
                    to="/cart"
                    aria-label={`Cart, ${itemCount} items`}
                    className="text-gray-600 hover:text-blush transition-colors p-1 relative"
                  >
                    <ShoppingBag
                      className={cn(
                        "w-5 h-5 sm:w-6 sm:h-6 transition-transform text-gray-600",
                        cartBouncing && "animate-cart-bounce",
                      )}
                    />
                    <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 grid h-3.5 min-w-[0.875rem] sm:h-4 sm:min-w-[1rem] place-items-center rounded-full bg-blush text-[0.5rem] sm:text-[0.55rem] font-bold text-white px-0.5 shadow-soft">
                      {itemCount}
                    </span>
                  </Link>
                </div>
              </div>

              {/* Desktop Navbar Placement */}
              <div className="hidden lg:flex items-center justify-between h-16">
                <Link to="/" className="flex items-center gap-3 group btn-bounce-hover transition-all duration-300" aria-label="Peach Craft home" style={{ transform: `scale(${compact ? 1 : 1.25})`, transformOrigin: "left center" }}>
                  <img
                    src={logoUrl}
                    alt="Peach Craft logo"
                    className="w-10 h-10 object-contain transition-transform group-hover:rotate-12"
                  />
                  <span className="font-display text-2xl">
                    <span className="text-gray-900">Peach</span>{" "}
                    <span className="text-blush font-bold">Craft</span>
                  </span>
                </Link>

                <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 bg-gray-100 rounded-full px-1.5 py-1.5">
                  {nav.map((item) => {
                    const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "relative px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300 btn-bounce-hover",
                          active
                            ? "bg-blush text-blush-foreground"
                            : "text-foreground/80 hover:text-foreground hover:bg-accent/50",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-4">
                  {/* Currency — desktop */}
                  <div className="hidden lg:block">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                          {currency}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        sideOffset={8}
                        className="w-64 p-0"
                      >
                        <Command>
                          <CommandInput placeholder="Search currencies..." />
                          <CommandList>
                            <CommandEmpty>No currency found.</CommandEmpty>
                            <CommandGroup>
                              {CURRENCIES.map((c) => (
                                <CommandItem
                                  key={c.code}
                                  value={`${c.label} ${c.code}`}
                                  onSelect={() => setCurrency(c.code as any)}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span>
                                      {c.label}{" | "}{c.code} {c.symbol}
                                    </span>
                                    {currency === c.code && (
                                      <Check className="w-4 h-4 text-primary shrink-0" />
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Search button */}
                  <button
                    type="button"
                    aria-label="Search"
                    onClick={openSearch}
                    className="text-gray-500 hover:text-gray-800 transition-colors shrink-0"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  {/* Auth — desktop */}
                  {isLoggedIn ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          title={userEmail ?? ""}
                          className="text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                            <path d="M20 21a8 8 0 0 0-16 0" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="min-w-48"
                      >
                        <DropdownMenuLabel className="font-normal text-xs text-foreground/60">
                          {userEmail}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/profile" className="cursor-pointer">
                            Edit Profile
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                          Sign out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Link
                      to="/login"
                      id="header-sign-in-btn"
                      className="text-gray-500 hover:text-gray-800 transition-colors shrink-0"
                      aria-label="Sign In"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </Link>
                  )}

                  {/* Orders */}
                  <Link
                    to="/orders"
                    aria-label="My Orders"
                    className="text-gray-500 hover:text-gray-800 transition-colors shrink-0"
                  >
                    <Package className="w-5 h-5" />
                  </Link>

                  {/* Cart */}
                  <Link
                    to="/cart"
                    aria-label={`Cart, ${itemCount} items`}
                    className="text-gray-500 hover:text-gray-800 transition-colors relative shrink-0"
                  >
                    <ShoppingBag
                      className={cn(
                        "w-5 h-5 transition-transform",
                        cartBouncing && "animate-cart-bounce",
                      )}
                    />
                    {itemCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 text-[0.6rem] font-semibold text-gray-500">
                        {itemCount}
                      </span>
                    )}
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Mobile nav menu ── */}
        {mobileOpen && !searchOpen && (
          <nav
            aria-label="Mobile"
            className="lg:hidden border-b border-border/40 bg-background animate-fade-in rounded-b-[2rem] overflow-hidden"
          >
            <ul className="px-6 py-6 space-y-2">
              {nav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block px-4 py-3 rounded-2xl text-base font-semibold hover:bg-accent/50 text-foreground transition-all"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/orders"
                  className="block px-4 py-3 rounded-2xl text-base font-semibold hover:bg-accent/50 text-foreground transition-all"
                >
                  My Orders
                </Link>
              </li>
              {/* Currency — mobile */}
              <li className="px-4 py-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-2xl bg-accent/40 px-4 py-3 text-base font-semibold text-foreground cursor-pointer"
                    >
                      <span>{currency}</span>
                      <ChevronDown className="w-4 h-4 text-foreground/60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={4}
                    className="w-72 p-0"
                  >
                    <Command>
                      <CommandInput placeholder="Search currencies..." />
                      <CommandList>
                        <CommandEmpty>No currency found.</CommandEmpty>
                        <CommandGroup>
                          {CURRENCIES.map((c) => (
                            <CommandItem
                              key={c.code}
                              value={`${c.label} ${c.code}`}
                              onSelect={() => setCurrency(c.code as any)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span>
                                  {c.label}{" | "}{c.code} {c.symbol}
                                </span>
                                {currency === c.code && (
                                  <Check className="w-4 h-4 text-primary shrink-0" />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </li>

              <li className="pt-2 border-t border-border mt-4">
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 rounded-2xl text-base font-semibold hover:bg-accent/50 text-foreground/80 transition-all"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-base font-bold text-foreground hover:bg-accent/50 transition-all"
                    aria-label="Sign In"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        )}

        {/* ── Predictive search dropdown ── */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-50 bg-background/98 backdrop-blur-xl border-b border-border shadow-soft animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {!hasSuggestions && !isLoadingSuggestions ? (
                /* No results state */
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <p className="text-sm text-foreground/50">
                    No matches for <strong className="text-foreground">"{query}"</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit(query)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:-translate-y-0.5 transition-all"
                  >
                    Search all products <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-0 lg:gap-8">

                  {/* ── Left: Suggestions ── */}
                  {(suggestions.categories.length > 0 || suggestions.brands.length > 0) && (
                    <div className="pb-4 lg:pb-0 mb-4 lg:mb-0 border-b lg:border-b-0 lg:border-r border-border lg:pr-8">
                      {suggestions.categories.length > 0 && (
                        <div className="mb-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 mb-2.5">
                            Categories
                          </p>
                          <ul className="space-y-1">
                            {suggestions.categories.map((cat) => (
                              <li key={cat}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectSuggestion(cat)}
                                  className="flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors group"
                                >
                                  <Package className="w-3.5 h-3.5 text-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
                                  <HighlightMatch text={cat} query={query} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {suggestions.brands.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 mb-2.5">
                            Brands
                          </p>
                          <ul className="space-y-1">
                            {suggestions.brands.map((brand) => (
                              <li key={brand}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectSuggestion(brand)}
                                  className="flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors group"
                                >
                                  <Tag className="w-3.5 h-3.5 text-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
                                  <HighlightMatch text={brand} query={query} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Right: Products ── */}
                  {suggestions.products.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 mb-2.5">
                        Products
                      </p>
                      <ul className="space-y-1">
                        {suggestions.products.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectProduct(p.id)}
                              className="flex items-center gap-3 w-full text-left px-2 py-2 rounded-xl hover:bg-accent transition-colors group"
                            >
                              {/* Thumbnail */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-cream shrink-0 border border-border">
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-5 h-5 text-foreground/20" />
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                                  <HighlightMatch text={p.name} query={query} />
                                </p>
                                <p className="text-xs text-foreground/50 mt-0.5 flex items-center gap-1.5">
                                  <span>{p.brand}</span>
                                  {p.category && (
                                    <>
                                      <span className="h-1 w-1 rounded-full bg-foreground/30" />
                                      <span>{p.category}</span>
                                    </>
                                  )}
                                </p>
                              </div>

                              {/* Price */}
                              <span className="text-sm font-bold text-foreground shrink-0">
                                {formatPrice(p.price)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── Footer: View all results ── */}
              {hasSuggestions && (
                <div className="mt-5 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit(query)}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-accent/50 hover:bg-accent text-sm font-semibold text-foreground hover:text-primary transition-all group"
                  >
                    <span>
                      Search all results for{" "}
                      <span className="text-primary">"{query}"</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
