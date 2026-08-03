"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";

export default function MentorDrawer({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commentary, setCommentary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (commentary) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/mentor`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate mentor comments.");
      } else {
        setCommentary(data.commentary);
      }
    } catch {
      setError("Could not generate mentor comments.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-24 md:bottom-6 right-6 z-30 px-5 py-3 min-h-[44px] rounded-full bg-[#0d9488] text-white font-body text-sm font-semibold shadow-lg hover:brightness-95 transition"
      >
        Show Mentor&apos;s Comments
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl text-av-navy">
                Mentor&apos;s Comments
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate hover:text-av-navy"
              >
                <X size={20} />
              </button>
            </div>

            {loading && (
              <p className="font-body text-sm text-av-slate">
                Generating commentary...
              </p>
            )}

            {error && (
              <div className="flex flex-col gap-3">
                <p className="font-body text-sm text-av-red">{error}</p>
                <Button variant="secondary" onClick={handleOpen}>
                  Retry
                </Button>
              </div>
            )}

            {commentary && (
              <p className="font-body text-sm text-av-navy whitespace-pre-line leading-relaxed">
                {commentary}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
