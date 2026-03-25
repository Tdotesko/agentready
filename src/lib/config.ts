export const config = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    prices: {
      growth: process.env.STRIPE_PRICE_GROWTH!,
      business: process.env.STRIPE_PRICE_BUSINESS!,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
      starter: process.env.STRIPE_PRICE_STARTER || "",
      pro: process.env.STRIPE_PRICE_PRO || "",
      agency: process.env.STRIPE_PRICE_AGENCY || "",
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  siteUrl: "https://cartparse.com",
  siteName: "CartParse",
};

export type Plan = "growth" | "business" | "enterprise" | "starter" | "pro" | "agency";

export interface PlanConfig {
  name: string;
  pages: number;        // max pages per scan
  stores: number;       // max monitored stores
  compare: boolean;     // competitor comparison
  comparesPerMonth: number;
  rescanInterval: string; // minimum rescan interval
  api: boolean;         // REST API access
  webhooks: boolean;    // webhook notifications
  whiteLabel: boolean;  // white-label reports
  fixCodeDetail: "generic" | "platform" | "platform-paths"; // fix code detail level
}

export const planLimits: Record<string, PlanConfig> = {
  growth: {
    name: "Growth",
    pages: 50,
    stores: 5,
    compare: false,
    comparesPerMonth: 0,
    rescanInterval: "weekly",
    api: false,
    webhooks: false,
    whiteLabel: false,
    fixCodeDetail: "platform",
  },
  business: {
    name: "Business",
    pages: 150,
    stores: 25,
    compare: true,
    comparesPerMonth: 10,
    rescanInterval: "daily",
    api: false,
    webhooks: true,
    whiteLabel: false,
    fixCodeDetail: "platform",
  },
  enterprise: {
    name: "Enterprise",
    pages: 500,
    stores: 9999,
    compare: true,
    comparesPerMonth: 9999,
    rescanInterval: "hourly",
    api: true,
    webhooks: true,
    whiteLabel: true,
    fixCodeDetail: "platform-paths",
  },
  // Legacy
  starter: { name: "Starter", pages: 25, stores: 3, compare: false, comparesPerMonth: 0, rescanInterval: "weekly", api: false, webhooks: false, whiteLabel: false, fixCodeDetail: "generic" },
  pro: { name: "Pro", pages: 150, stores: 999, compare: true, comparesPerMonth: 999, rescanInterval: "daily", api: false, webhooks: true, whiteLabel: false, fixCodeDetail: "platform" },
  agency: { name: "Agency", pages: 500, stores: 999, compare: true, comparesPerMonth: 999, rescanInterval: "daily", api: true, webhooks: true, whiteLabel: true, fixCodeDetail: "platform-paths" },
};

export function getPlanConfig(plan?: string, isAdmin?: boolean): PlanConfig {
  if (isAdmin) return planLimits.enterprise;
  return planLimits[plan || ""] || { name: "Free", pages: 1, stores: 0, compare: false, comparesPerMonth: 0, rescanInterval: "never", api: false, webhooks: false, whiteLabel: false, fixCodeDetail: "generic" };
}
