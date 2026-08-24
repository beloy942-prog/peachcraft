"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronRight,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Mail,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type SubItem = {
  title: string;
  url: string;
};

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: SubItem[];
};

const navMain: NavItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Products", url: "/admin/products", icon: Package },
  {
    title: "Orders",
    url: "/admin/orders",
    icon: ShoppingCart,
    items: [
      { title: "All Orders", url: "/admin/orders" },
      { title: "Returns", url: "/admin/orders/returns" },
      { title: "Order Tracking", url: "/admin/orders/tracking" },
    ],
  },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Customers", url: "/admin/customers", icon: Users },
  { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
  { title: "Messages", url: "/admin/messages", icon: Inbox },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

const navSettings: NavItem[] = [
  { title: "Settings", url: "/admin/website-settings", icon: Settings },
];

function NavItemComponent({ item, activePath }: { item: NavItem; activePath: string }) {
  const isActive = item.url === "/admin"
    ? activePath === "/admin"
    : activePath.startsWith(item.url);
  const hasSubItems = item.items && item.items.length > 0;
  const isSubItemActive = hasSubItems && item.items!.some((sub) => activePath.startsWith(sub.url));

  if (!hasSubItems) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive || isSubItemActive} tooltip={item.title}>
          <Link to={item.url}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen={isActive || isSubItemActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive || isSubItemActive} tooltip={item.title}>
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items!.map((sub) => {
              const isSubActive = activePath.startsWith(sub.url);
              return (
                <SidebarMenuSubItem key={sub.title}>
                  <SidebarMenuSubButton asChild isActive={isSubActive}>
                    <Link to={sub.url}>{sub.title}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { location } = useRouterState();
  const activePath = location.pathname ?? "/admin";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Package className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Peach Craft</span>
                  <span className="truncate text-xs text-muted-foreground">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <NavItemComponent key={item.title} item={item} activePath={activePath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navSettings.map((item) => (
                <NavItemComponent key={item.title} item={item} activePath={activePath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
}
