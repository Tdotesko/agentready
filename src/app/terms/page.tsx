export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CartParse" className="h-8 w-auto" />
          </a>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--text-dim)] mb-8">Last updated: March 24, 2026</p>

        <div className="space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using CartParse ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Description of Service</h2>
            <p>CartParse provides AI agent readiness scanning and analysis tools for e-commerce stores. The Service scans publicly accessible web pages to evaluate their readiness for AI shopping agents and provides recommendations for improvement.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Accounts and Subscriptions</h2>
            <p>You must provide a valid email address and password to create an account. You are responsible for maintaining the security of your account credentials. Paid subscriptions are billed monthly through Stripe. You may cancel your subscription at any time through the billing portal on your dashboard. Cancellation takes effect at the end of the current billing period.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Acceptable Use</h2>
            <p>You agree not to: (a) use the Service to scan websites you do not own or have permission to scan in an abusive manner; (b) attempt to circumvent rate limits or access controls; (c) resell access to the Service without an Agency or Enterprise plan; (d) use the Service for any unlawful purpose.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Scanning and Data</h2>
            <p>CartParse scans publicly accessible web pages. We do not access password-protected content, private APIs, or any data not publicly available. Scan results are stored in your account and are not shared with other users. We may use anonymized, aggregated scan data to improve the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Payment Terms</h2>
            <p>All payments are processed securely through Stripe. Prices are in USD and are subject to change with 30 days notice. Refunds may be issued at our discretion within 14 days of purchase for annual plans. Monthly subscriptions are non-refundable but can be cancelled at any time.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Disclaimer</h2>
            <p>The Service is provided "as is" without warranties of any kind. Scan results are informational and do not guarantee any specific outcome. We do not guarantee that implementing our recommendations will result in improved AI agent discoverability or increased sales.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Limitation of Liability</h2>
            <p>CartParse shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">9. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the updated terms. We will notify users of material changes via email.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">10. Contact</h2>
            <p>For questions about these Terms, contact us at hello@cartparse.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
