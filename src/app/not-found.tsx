import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-6xl font-mono font-bold text-[var(--text-dim)] mb-4">404</p>
        <h2 className="text-lg font-bold text-white mb-2">Page not found</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">That page doesn&apos;t exist or has been moved.</p>
        <Link href="/" className="px-5 py-2.5 rounded-xl btn-primary text-sm inline-block">Back to home</Link>
      </div>
    </div>
  );
}
