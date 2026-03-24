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
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-500 mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
