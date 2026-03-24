export const config = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    prices: {
      growth: process.env.STRIPE_PRICE_GROWTH!,
      business: process.env.STRIPE_PRICE_BUSINESS!,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
      // Legacy (keep for existing subs)
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

export const planLimits: Record<string, { stores: number; name: string; compare: boolean }> = {
  growth: { stores: 5, name: "Growth", compare: false },
  business: { stores: 25, name: "Business", compare: true },
  enterprise: { stores: 999, name: "Enterprise", compare: true },
  starter: { stores: 3, name: "Starter", compare: false },
  pro: { stores: 999, name: "Pro", compare: true },
  agency: { stores: 999, name: "Agency", compare: true },
};
