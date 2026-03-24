import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { config } from "@/lib/config";
import { findUserByStripeCustomer, updateUser } from "@/lib/users";
import type { Plan } from "@/lib/config";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, config.stripe.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await findUserByStripeCustomer(customerId);
      if (user) {
        await updateUser(user.id, {
          plan: (sub.metadata.plan as Plan) || user.plan,
          subscriptionId: sub.id,
          subscriptionStatus: sub.status,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const user = await findUserByStripeCustomer(customerId);
      if (user) {
        await updateUser(user.id, {
          plan: undefined,
          subscriptionId: undefined,
          subscriptionStatus: "canceled",
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
