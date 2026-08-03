"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import Logo from "@/components/Logo";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }

    const firstTime = searchParams.get("firstTime") === "1";
    router.push(firstTime ? "/welcome" : "/deals");
    router.refresh();
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-av-navy px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="scale-125">
            <Logo />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="font-display text-2xl text-av-navy mb-6 text-center">
            Sign in
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-av-red font-body" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-av-slate font-body text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-av-navy font-semibold underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
