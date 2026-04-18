import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Portfolio Pilot",
  description: "A local investment portfolio tracker built with Next.js and SQLite.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full bg-stone-50">
        <CurrencyProvider>
          <Navbar />
          <main className="pt-16">{children}</main>
        </CurrencyProvider>
      </body>
    </html>
  );
}
