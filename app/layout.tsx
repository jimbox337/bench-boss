import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import { DataProvider } from "@/lib/DataContext";
import { AuthProvider } from "@/lib/AuthContext";

// One grotesque family: Archivo for text, and its wide cut (font-stretch) for headings and scores.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-app" });

export const viewport: Viewport = { themeColor: "#0d121b", colorScheme: "dark" };

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
    <html lang="en" className="dark">
      <body className={archivo.variable}>
        <AuthProvider>
          <DataProvider>
            <Layout>{children}</Layout>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
