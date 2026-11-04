import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import { DataProvider } from "@/lib/DataContext";
import { AuthProvider } from "@/lib/AuthContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-app" });

const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });

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
      <body className={`${inter.variable} ${poppins.variable}`}>
        <AuthProvider>
          <DataProvider>
            <Layout>{children}</Layout>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
