import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luvre Franc — Modern essentials, quietly considered",
  description: "A considered wardrobe of modern menswear and daily objects, payable with USDC on Arc Testnet through Druto.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
