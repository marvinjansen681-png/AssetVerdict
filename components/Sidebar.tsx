import Link from "next/link";
import { Home, Briefcase, MapPin } from "lucide-react";
import Logo from "./Logo";

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-[220px] shrink-0 border-r border-av-light-grey bg-white h-screen sticky top-0 px-4 py-6">
      <div className="mb-8 px-2">
        <Logo />
      </div>
      <nav className="flex flex-col gap-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-av-slate hover:bg-av-light-grey hover:text-av-navy font-body text-sm transition-colors"
        >
          <Home size={18} />
          Home
        </Link>
        <Link
          href="/deals"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-av-slate hover:bg-av-light-grey hover:text-av-navy font-body text-sm transition-colors"
        >
          <Briefcase size={18} />
          My Deals
        </Link>
        <Link
          href="/suburbs"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-av-slate hover:bg-av-light-grey hover:text-av-navy font-body text-sm transition-colors"
        >
          <MapPin size={18} />
          Suburb Profiles
        </Link>
      </nav>
    </aside>
  );
}
