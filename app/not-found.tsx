import Link from "next/link";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-av-white">
      <div className="mb-8">
        <Logo size={32} />
      </div>
      <h1 className="font-display text-3xl text-av-navy mb-2">
        Deal not found
      </h1>
      <p className="font-body text-sm text-av-slate mb-8 max-w-sm">
        The page or deal you&apos;re looking for doesn&apos;t exist, or you
        don&apos;t have access to it.
      </p>
      <Link href="/deals">
        <Button>Back to My Deals</Button>
      </Link>
    </div>
  );
}
