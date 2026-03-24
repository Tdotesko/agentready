import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-white mb-2">Page not found</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">That page doesn&apos;t exist.</p>
        <Link href="/"
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 transition inline-block">
          Back to home
        </Link>
      </div>
    </div>
  );
}
