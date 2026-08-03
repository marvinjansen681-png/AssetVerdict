"use client";

import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-av-white">
      <div className="mb-8">
        <Logo size={32} />
      </div>
      <h1 className="font-display text-3xl text-av-navy mb-2">
        Something went wrong
      </h1>
      <p className="font-body text-sm text-av-slate mb-8 max-w-sm">
        An unexpected error occurred while loading this page. You can try
        again, or head back to your deals.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
