import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { config } from "@/lib/config";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found." }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.appUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
