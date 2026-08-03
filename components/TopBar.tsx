"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import Logo from "./Logo";
import MobileNav from "./MobileNav";

export default function TopBar() {
  const { data: session } = useSession();
  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  return (
    <header className="flex items-center justify-between px-4 md:px-8 h-16 border-b border-av-light-grey bg-white sticky top-0 z-10">
      <div className="flex items-center gap-3 md:hidden">
        <MobileNav />
        <Logo size={24} />
      </div>
      <div className="hidden md:block" />
      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-body text-av-navy font-semibold">
              {user.name}
            </span>
            <span className="text-xs font-body text-av-slate">
              {user.email}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-av-navy text-av-white flex items-center justify-center font-body text-sm font-semibold">
            {initials}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out"
            title="Sign out"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-av-slate hover:bg-av-light-grey hover:text-av-red transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </header>
  );
}
