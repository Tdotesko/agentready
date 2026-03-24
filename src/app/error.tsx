"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm fade-up">
        <div className="w-12 h-12 rounded-2xl bg-[var(--red-soft)] border border-[rgba(248,113,113,0.12)] flex items-center justify-center mx-auto mb-5">
          <svg className="w-6 h-6 text-[var(--red)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset} className="px-5 py-2.5 rounded-xl btn-primary text-sm cursor-pointer">Try again</button>
      </div>
    </div>
  );
}
