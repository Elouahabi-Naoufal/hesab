import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/favicon.png?v=1", apple: "/logo.png?v=1" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}