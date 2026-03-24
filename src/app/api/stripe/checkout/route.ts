import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateUser } from "@/lib/users";
import { stripe, getPriceId } from "@/lib/stripe";
import { config } from "@/lib/config";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { plan } = await req.json();
  const priceId = getPriceId(plan);
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await updateUser(user.id, { stripeCustomerId: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.appUrl}/dashboard?upgraded=true`,
    cancel_url: `${config.appUrl}/dashboard`,
    subscription_data: { metadata: { userId: user.id, plan } },
  });

  return NextResponse.json({ url: session.url });
}
