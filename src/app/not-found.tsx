import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold mb-2">Page not found</h2>
        <p className="text-sm text-neutral-500 mb-6">
          That page doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition inline-block"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
