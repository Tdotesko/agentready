export const config = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    prices: {
      starter: process.env.STRIPE_PRICE_STARTER!,
      pro: process.env.STRIPE_PRICE_PRO!,
      agency: process.env.STRIPE_PRICE_AGENCY!,
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

export type Plan = "starter" | "pro" | "agency";

export const planLimits: Record<Plan, { stores: number; name: string }> = {
  starter: { stores: 3, name: "Starter" },
  pro: { stores: 999, name: "Pro" },
  agency: { stores: 999, name: "Agency" },
};
