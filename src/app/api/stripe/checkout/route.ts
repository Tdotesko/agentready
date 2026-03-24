import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateUser, findUserById } from "@/lib/users";
import { stripe, getPriceId } from "@/lib/stripe";
import { config } from "@/lib/config";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json();
  const plan = typeof body.plan === "string" ? body.plan : "";
  const priceId = getPriceId(plan);
  if (!priceId) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  try {
    // Create or reuse Stripe customer (re-read user to prevent race condition)
    const freshUser = await findUserById(user.id);
    let customerId = freshUser?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
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
  } catch {
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }
}
