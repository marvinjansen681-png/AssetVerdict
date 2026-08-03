import type { Metadata } from "next";
import "../styles/globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "AssetVerdict | Know Before You Commit",
  description:
    "Model, analyse, and score commercial property deals with AssetVerdict.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "AssetVerdict | Know Before You Commit",
    description:
      "Model, analyse, and score commercial property deals with AssetVerdict.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0F1F3D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <SessionProviderWrapper>
          <ToastProvider>{children}</ToastProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
