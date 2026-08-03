import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-24 min-h-[calc(100vh-4rem)]">
      <svg
        width={64}
        height={64}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-6"
      >
        <path
          d="M16 2 L28 7 V15 C28 22.5 22.8 27.8 16 30 C9.2 27.8 4 22.5 4 15 V7 L16 2 Z"
          fill="#0F1F3D"
          stroke="#C9A84C"
          strokeWidth="1.5"
        />
        <path
          d="M10.5 15.5 L14 19 L21.5 11"
          stroke="#C9A84C"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <h1 className="font-display text-5xl md:text-6xl text-av-navy mb-4">
        AssetVerdict
      </h1>
      <p className="font-body text-lg text-av-slate mb-10">
        Know Before You Commit.
      </p>
      <Link
        href="/deals/new"
        className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-av-gold text-av-navy font-body font-semibold text-sm tracking-wide hover:brightness-95 transition"
      >
        Start a New Deal
      </Link>
    </div>
  );
}
