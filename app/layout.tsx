import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import { DataProvider } from "@/lib/DataContext";
import { AuthProvider } from "@/lib/AuthContext";

// Athletic, broadcast-style type: Barlow for body, Barlow Condensed for headings and scores.
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-app" });

const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "Bench Boss - Fantasy Hockey Assistant",
  description: "Optimize your fantasy hockey lineup",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${barlow.variable} ${barlowCondensed.variable}`}>
        <AuthProvider>
          <DataProvider>
            <Layout>{children}</Layout>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
