import Stripe from "stripe";
import { config } from "./config";

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2026-02-25.clover",
});

export function getPriceId(plan: string): string | null {
  switch (plan) {
    case "starter": return config.stripe.prices.starter;
    case "pro": return config.stripe.prices.pro;
    case "agency": return config.stripe.prices.agency;
    default: return null;
  }
}
