import Stripe from "stripe";
import { config } from "./config";

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2026-02-25.clover",
});

export function getPriceId(plan: string): string | null {
  const prices = config.stripe.prices as Record<string, string>;
  return prices[plan] || null;
}
