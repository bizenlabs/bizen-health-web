"use client";

export function OrgSwitchingOverlay({ orgName }: { orgName: string | null }) {
  if (!orgName) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80"
    >
      <div className="flex flex-col items-center gap-3">
        <svg
          className="size-8 animate-spin text-zinc-700 dark:text-zinc-300"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Switching to {orgName}…
        </p>
      </div>
    </div>
  );
}
