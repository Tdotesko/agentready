"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 transition cursor-pointer">
          Try again
        </button>
      </div>
    </div>
  );
}
