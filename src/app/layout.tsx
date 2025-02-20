import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { initializeAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SUPPLY: THE FUTURE - Physical Asset Verification",
  description:
    "Blockchain-based physical asset verification and ownership tracking system for authenticating and managing SUPPLY: THE FUTURE apparel through secure NFC integration.",
  keywords:
    "blockchain, verification, NFC, physical assets, supply chain, ownership tracking, authentication",
  authors: [{ name: "SUPPLY: THE FUTURE" }],
  metadataBase: new URL("https://verify.supply.tf"),
  openGraph: {
    title: "SUPPLY: THE FUTURE - Physical Asset Verification",
    description:
      "Secure blockchain verification system for SUPPLY: THE FUTURE apparel",
    url: "https://verify.supply.tf",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize admin user if needed
  await initializeAdmin();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider defaultTheme="dark">
          <div className="min-h-screen bg-background">
            {children}
            <div className="fixed bottom-4 right-4">
              <ThemeToggle />
            </div>
          </div>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
