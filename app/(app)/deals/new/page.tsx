"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const PROPERTY_TYPES = ["Commercial", "Residential", "Industrial", "Mixed Use"];

export default function NewDealPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("Commercial");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, propertyType, address, notes }),
    });

    if (!res.ok) {
      setError("Could not create deal. Please try again.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    router.push(`/deals/${data.id}/edit?tab=acquisition`);
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-av-navy mb-6">New Deal</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-body text-av-slate mb-1.5">
            Deal Name *
          </label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rivonia Office Park"
          />
        </div>
        <div>
          <label className="block text-sm font-body text-av-slate mb-1.5">
            Property Type
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-body text-av-slate mb-1.5">
            Address
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, City"
          />
        </div>
        <div>
          <label className="block text-sm font-body text-av-slate mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
          />
        </div>
        {error && <p className="text-sm text-av-red font-body">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Creating..." : "Create Deal"}
        </Button>
      </form>
    </div>
  );
}
