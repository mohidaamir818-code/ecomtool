export interface NavItem {
  label: string;
  href: string;
  icon: string;
  active?: boolean;
}

export interface StatCardData {
  title: string;
  value: string;
  subtitle?: string;
  progress?: number;
  progressColor?: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: string;
}

export interface RecentRequest {
  id: string;
  title: string;
  subtitle: string;
  status: "Completed" | "Processing" | "Pending" | "Failed";
  time: string;
  icon: string;
}

export interface QuickAction {
  title: string;
  description: string;
  icon: string;
  href: string;
}

export interface ProductHandlingStat {
  label: string;
  value: string;
  change: string;
  changeType: "up" | "down";
  iconColor: string;
}
