"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/login?firstTime=1");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-av-navy px-4">
      <div className="w-full max-w-sm">
        <BackButton href="/" label="Home" variant="dark" className="mb-4" />
        <div className="flex justify-center mb-8">
          <div className="scale-125">
            <Logo />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="font-display text-2xl text-av-navy mb-6 text-center">
            Create your account
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-body text-av-slate mb-1.5">
                Name
              </label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Investor"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-av-slate mb-1.5">
                Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-av-slate mb-1.5">
                Password
              </label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-body text-av-slate mb-1.5">
                Confirm Password
              </label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-av-red font-body" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-av-slate font-body text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-av-navy font-semibold underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
