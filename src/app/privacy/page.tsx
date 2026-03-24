export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--text-dim)] mb-8">Last updated: March 24, 2026</p>

        <div className="space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Information We Collect</h2>
            <p><strong className="text-[var(--text)]">Account information:</strong> email address, hashed password (we never store your password in plain text).</p>
            <p className="mt-2"><strong className="text-[var(--text)]">Payment information:</strong> processed and stored securely by Stripe. We do not store credit card numbers.</p>
            <p className="mt-2"><strong className="text-[var(--text)]">Scan data:</strong> URLs you scan, scan results, and scores. This data is associated with your account.</p>
            <p className="mt-2"><strong className="text-[var(--text)]">Usage data:</strong> pages visited, features used, and general analytics to improve the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <p>We use your information to: (a) provide and improve the Service; (b) process payments; (c) send scan results and account notifications; (d) send marketing emails if you opt in (you can unsubscribe at any time); (e) generate anonymized, aggregated statistics about AI agent readiness across the e-commerce industry.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Data We Scan</h2>
            <p>CartParse only accesses publicly available web pages. We do not: (a) access password-protected areas; (b) collect personal data from the websites we scan; (c) store the full HTML of scanned pages beyond the duration of the scan; (d) share individual scan results with third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Data Storage and Security</h2>
            <p>Your data is stored in a PostgreSQL database hosted on Railway with encrypted connections. Passwords are hashed using bcrypt with a cost factor of 12. Sessions use signed JWT tokens stored in HTTP-only cookies. All connections use HTTPS/TLS encryption.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-[var(--text)]">Stripe</strong> for payment processing</li>
              <li><strong className="text-[var(--text)]">Resend</strong> for transactional and marketing emails</li>
              <li><strong className="text-[var(--text)]">Railway</strong> for hosting and database</li>
            </ul>
            <p className="mt-2">Each of these services has their own privacy policy governing their use of your data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Cookies</h2>
            <p>We use a single session cookie (ar_session) to maintain your login session. This cookie is HTTP-only, secure, and expires after 7 days. We do not use tracking cookies or third-party advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Email Communications</h2>
            <p>We may send you: (a) transactional emails (scan results, password resets, billing notifications); (b) marketing emails about product updates and tips. You can unsubscribe from marketing emails at any time using the unsubscribe link in every email. Transactional emails cannot be opted out of while you maintain an active account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Data Retention</h2>
            <p>Account data is retained as long as your account is active. Scan results are retained indefinitely to provide historical tracking. If you delete your account, your personal data will be removed within 30 days. Anonymized, aggregated data may be retained indefinitely.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">9. Your Rights</h2>
            <p>You have the right to: (a) access your personal data; (b) correct inaccurate data; (c) request deletion of your data; (d) export your scan data; (e) opt out of marketing communications. Contact us at hello@cartparse.com to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">10. Changes to This Policy</h2>
            <p>We may update this privacy policy at any time. We will notify you of material changes via email. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">11. Contact</h2>
            <p>For privacy-related questions, contact us at hello@cartparse.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
