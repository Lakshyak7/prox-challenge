import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vulcan OmniPro 220 — Support Agent",
  description: "AI-powered technical support for the Vulcan OmniPro 220 multiprocess welder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
