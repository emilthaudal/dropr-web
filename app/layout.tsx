import type { Metadata } from "next";
import "./globals.css";
import { Cinzel, Rajdhani } from "next/font/google";
import { cn } from "@/lib/utils";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-rajdhani",
});

export const metadata: Metadata = {
  title: "Dropr — Raidbots Droptimizer Import",
  description:
    "Generate a Dropr import string from your Raidbots droptimizer report for in-game M+ loot reminders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", cinzel.variable, rajdhani.variable)}
    >
      <body>{children}</body>
    </html>
  );
}
