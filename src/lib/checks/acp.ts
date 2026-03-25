import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export function checkACPProtocol(ctx: CheckContext): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 15;

  // ACP (Agentic Commerce Protocol) checks based on discoverable signals in HTML and headers

  // 1. Checkout endpoint hints
  const hasCheckoutApi = ctx.$('link[rel*="checkout"], meta[name*="checkout"], [data-checkout-url]').length > 0 || ctx.html.includes("/api/checkout") || ctx.html.includes("/cart/checkout");
  if (hasCheckoutApi) { score += 3; findings.push("Checkout endpoint detected"); checks.push(check("Checkout endpoint", true, 3, 3, "Discoverable")); }
  else { checks.push(check("Checkout endpoint", false, 0, 3, "Not discoverable")); recommendations.push("Make your checkout endpoint discoverable. AI agents need to find the checkout flow to complete purchases on behalf of customers."); }

  // 2. Cart API
  const hasCartApi = ctx.html.includes("/cart") || ctx.html.includes("cart.js") || ctx.$('form[action*="cart"]').length > 0 || ctx.html.includes("addToCart") || ctx.html.includes("add-to-cart");
  if (hasCartApi) { score += 2; findings.push("Cart functionality detected"); checks.push(check("Cart API", true, 2, 2, "Found")); }
  else { checks.push(check("Cart API", false, 0, 2, "Not detected")); }

  // 3. Payment method signals
  const paymentMethods = ctx.$('[class*="payment"], [data-payment], [alt*="visa"], [alt*="mastercard"], [alt*="paypal"], [alt*="apple-pay"], [alt*="google-pay"], [class*="stripe"]').length;
  if (paymentMethods > 0) { score += 2; findings.push(`${paymentMethods} payment method signal(s)`); checks.push(check("Payment methods", true, 2, 2, `${paymentMethods} detected`)); }
  else { checks.push(check("Payment methods", false, 0, 2, "None detected")); recommendations.push("Display accepted payment methods visibly on your pages. AI agents check this before recommending purchases."); }

  // 4. Inventory/stock signals in API
  const hasInventoryApi = ctx.html.includes("inventory") || ctx.html.includes("stock_count") || ctx.html.includes("quantityAvailable") || ctx.$('[data-inventory], [data-stock], [data-qty]').length > 0;
  if (hasInventoryApi) { score += 2; findings.push("Inventory data signals found"); checks.push(check("Inventory signals", true, 2, 2, "Detected")); }
  else { checks.push(check("Inventory signals", false, 0, 2, "Not detected")); }

  // 5. Order status / tracking hints
  const hasOrderTracking = ctx.$('a[href*="order"], a[href*="tracking"], a[href*="account"]').length > 0;
  if (hasOrderTracking) { score += 1; checks.push(check("Order tracking", true, 1, 1, "Links found")); }
  else { checks.push(check("Order tracking", false, 0, 1, "Not found")); }

  // 6. Returns/refund API hints
  const hasReturnsFlow = ctx.$('a[href*="return"], a[href*="refund"], a[href*="exchange"]').length > 0;
  if (hasReturnsFlow) { score += 1; findings.push("Returns/refund flow linked"); checks.push(check("Returns flow", true, 1, 1, "Linked")); }
  else { checks.push(check("Returns flow", false, 0, 1, "Not linked")); }

  // 7. Subscription/recurring signals
  const hasSubs = ctx.$('[class*="subscribe"], [class*="subscription"], [data-subscription], [class*="recurring"]').length > 0 || ctx.html.includes("subscription");
  if (hasSubs) { score += 1; findings.push("Subscription capability detected"); checks.push(check("Subscription support", true, 1, 1, "Detected")); }
  else { checks.push(check("Subscription support", false, 0, 1, "Not detected")); }

  // 8. API authentication hints
  const hasAuth = ctx.html.includes("api_key") || ctx.html.includes("apiKey") || ctx.html.includes("access_token") || ctx.headers["www-authenticate"] || ctx.$('meta[name*="api"]').length > 0;
  if (hasAuth) { score += 1; checks.push(check("API auth mechanism", true, 1, 1, "Signals found")); }
  else { checks.push(check("API auth mechanism", false, 0, 1, "Not detected")); }

  // 9. Storefront API (Shopify, BigCommerce, etc)
  const hasStorefrontApi = ctx.html.includes("storefront-access-token") || ctx.html.includes("StorefrontAccessToken") || ctx.html.includes("/api/") || ctx.html.includes("graphql");
  if (hasStorefrontApi) { score += 2; findings.push("Storefront API references found"); checks.push(check("Storefront API", true, 2, 2, "Detected")); }
  else { checks.push(check("Storefront API", false, 0, 2, "Not detected")); }

  // 10. Coupon/discount code input
  const hasCoupon = ctx.$('[class*="coupon"], [class*="discount"], [class*="promo-code"], input[name*="coupon"], input[name*="discount"]').length > 0;
  if (hasCoupon) { checks.push(check("Discount code", true, 0, 0, "Input found")); }
  else { checks.push(check("Discount code", false, 0, 0, "Not found")); }

  // 11. Wishlist API
  const hasWishlistApi = ctx.html.includes("wishlist") || ctx.$('[data-wishlist]').length > 0;
  if (hasWishlistApi) { checks.push(check("Wishlist API", true, 0, 0, "Detected")); }
  else { checks.push(check("Wishlist API", false, 0, 0, "Not detected")); }

  // 12. Gift card/wrap
  const hasGift = ctx.$('[class*="gift"], [class*="wrap"], input[name*="gift"]').length > 0;
  if (hasGift) { checks.push(check("Gift options", true, 0, 0, "Detected")); }
  else { checks.push(check("Gift options", false, 0, 0, "Not found")); }

  // 13. Multi-currency
  const hasCurrency = ctx.$('[class*="currency"], [data-currency], select[name*="currency"]').length > 0;
  if (hasCurrency) { checks.push(check("Multi-currency", true, 0, 0, "Detected")); findings.push("Multi-currency support"); }
  else { checks.push(check("Multi-currency", false, 0, 0, "Not detected")); }

  return { name: "Checkout & Payments", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
