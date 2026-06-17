import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "reactflow/dist/style.css";

export const metadata: Metadata = {
  title: "TopologyX - AI Architecture Copilot",
  description: "Generate Azure architecture diagrams, reviews, estimates, and IaC from natural language requirements."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-2xl font-bold tracking-tight text-slate-900">TopologyX</div>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
