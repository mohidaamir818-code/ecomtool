import type {
  NavItem,
  ProductHandlingStat,
  QuickAction,
  RecentRequest,
  StatCardData,
} from "../types";

export const dashboardNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Hunting", href: "/dashboard/hunting", icon: "search" },
  { label: "Handling Products", href: "/dashboard/products", icon: "box" },
  { label: "Check Competitors", href: "/dashboard/competitors", icon: "users" },
  { label: "AI Listing", href: "/dashboard/listings", icon: "spark" },
  { label: "Bulk Listing", href: "/dashboard/bulk-listing", icon: "list" },
  { label: "Suppliers Finder", href: "/dashboard/suppliers", icon: "truck" },
  { label: "Usage & Billing", href: "/dashboard/billing", icon: "chart" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
  { label: "Help Center", href: "/dashboard/help", icon: "help" },
];

export const statCards: StatCardData[] = [
  {
    title: "Remaining Requests",
    value: "4,250 of 5,000",
    progress: 85,
    progressColor: "bg-brand",
    icon: "send",
  },
  {
    title: "Products Handling",
    value: "1,248 Active",
    change: "↑ 12% vs last 7 days",
    changeType: "up",
    icon: "box",
  },
  {
    title: "Competitor Checks",
    value: "320 This Week",
    change: "↑ 8% vs last 7 days",
    changeType: "up",
    icon: "users",
  },
  {
    title: "Requests Today",
    value: "150 of 500",
    progress: 30,
    progressColor: "bg-sky-400",
    icon: "clock",
  },
];

export const productHandlingStats: ProductHandlingStat[] = [
  { label: "Active", value: "1,248", change: "+12%", changeType: "up", iconColor: "text-emerald-500 bg-emerald-50" },
  { label: "Processing", value: "86", change: "-5%", changeType: "down", iconColor: "text-orange-500 bg-orange-50" },
  { label: "Completed", value: "762", change: "+18%", changeType: "up", iconColor: "text-blue-500 bg-blue-50" },
];

export const recentRequests: RecentRequest[] = [
  { id: "1", title: "Hunting Request", subtitle: "Keyword: wireless headphones", status: "Completed", time: "2 mins ago", icon: "search" },
  { id: "2", title: "Competitor Check", subtitle: "Store: TechGadgets Pro", status: "Processing", time: "15 mins ago", icon: "users" },
  { id: "3", title: "Product Handling", subtitle: "SKU: WH-2024-BLK", status: "Completed", time: "1 hour ago", icon: "box" },
  { id: "4", title: "Keyword Research", subtitle: "Niche: fitness trackers", status: "Completed", time: "3 hours ago", icon: "key" },
  { id: "5", title: "Supplier Search", subtitle: "Category: home decor", status: "Pending", time: "5 hours ago", icon: "truck" },
];

export const quickActions: QuickAction[] = [
  { title: "Start Hunting", description: "Find winning products", icon: "search", href: "/dashboard/hunting" },
  { title: "Handle Products", description: "Manage your listings", icon: "box", href: "/dashboard/products" },
  { title: "Check Competitors", description: "Analyze competitor stores", icon: "users", href: "/dashboard/competitors" },
];

export const chartDates = ["May 12", "May 13", "May 14", "May 15", "May 16", "May 17", "May 18"];
