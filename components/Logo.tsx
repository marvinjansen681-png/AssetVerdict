import Link from "next/link";

export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
      <span className="font-display text-xl text-av-navy tracking-tight">
        AssetVerdict
      </span>
    </Link>
  );
}
