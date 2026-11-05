import type { Metadata, Viewport } from "next";
import { Saira } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import { DataProvider } from "@/lib/DataContext";
import { AuthProvider } from "@/lib/AuthContext";
import { PlayerCardProvider } from "@/components/player/PlayerCardProvider";

// Saira: squared, jersey-number shapes. Normal width for text; its extended cut (font-stretch)
// for headings and scores, like arena boards and broadcast score bugs.
const saira = Saira({ subsets: ["latin"], axes: ["wdth"], style: ["normal", "italic"], variable: "--font-app" });

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
    <html lang="en" className={`dark ${saira.variable}`}>
      <body>
        <AuthProvider>
          <DataProvider>
            <PlayerCardProvider>
              <Layout>{children}</Layout>
            </PlayerCardProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
