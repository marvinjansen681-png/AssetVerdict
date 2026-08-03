"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import Logo from "@/components/Logo";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const PROPERTY_TYPES = ["Commercial", "Residential", "Industrial", "Mixed Use"];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("Commercial");
  const [dealId, setDealId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, propertyType }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setDealId(data.id);
      setStep(3);
    }
  }

  return (
    <div className="min-h-screen bg-av-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={clsx(
                "w-2.5 h-2.5 rounded-full",
                s === step ? "bg-av-gold" : "bg-av-light-grey"
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="text-center">
            <h1 className="font-display text-2xl text-av-navy mb-4">
              Welcome to AssetVerdict
            </h1>
            <ul className="text-left font-body text-sm text-av-slate flex flex-col gap-3 mb-8">
              <li>
                • Model acquisition costs, financing, and cashflow for any
                commercial property deal.
              </li>
              <li>
                • Get an instant verdict with IRR, DSCR, cap rate, and 11 other
                gauge-driven metrics.
              </li>
              <li>
                • Switch between Bear, Base, and Bull scenarios to stress-test
                a deal before you commit.
              </li>
            </ul>
            <Button className="w-full" onClick={() => setStep(2)}>
              Get Started
            </Button>
            <Link
              href="/deals"
              className="block text-xs font-body text-av-slate mt-4 underline"
            >
              Skip for now
            </Link>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleCreateDeal}>
            <h1 className="font-display text-2xl text-av-navy mb-4 text-center">
              Create your first deal
            </h1>
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-sm font-body text-av-slate mb-1.5">
                  Deal Name
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
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              {creating ? "Creating..." : "Create Deal"}
            </Button>
          </form>
        )}

        {step === 3 && (
          <div className="text-center">
            <h1 className="font-display text-2xl text-av-navy mb-4">
              You&apos;re ready
            </h1>
            <p className="font-body text-sm text-av-slate mb-8">
              Your deal has been created. Fill in the acquisition, finance,
              and cashflow tabs to see your first verdict.
            </p>
            <Button
              className="w-full"
              onClick={() => router.push(`/deals/${dealId}/edit/introduction`)}
            >
              Go to my deal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
