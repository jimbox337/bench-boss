import type { Metadata, Viewport } from "next";
import { Saira } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import { DataProvider } from "@/lib/DataContext";
import { AuthProvider } from "@/lib/AuthContext";
import { PlayerCardProvider } from "@/components/player/PlayerCardProvider";

// Saira: squared, jersey-number shapes. Normal width for text; a slightly extended heavy cut
// (font-stretch 112%) for headings and scores, like arena boards and broadcast score bugs.
const saira = Saira({ subsets: ["latin"], axes: ["wdth"], variable: "--font-app" });

export const viewport: Viewport = { themeColor: "#0d121b", colorScheme: "dark" };

const SITE_URL = "https://www.benchboss.pro";
const TITLE = "Bench Boss: Free NHL Fantasy Hockey Projections & Tools";
const DESCRIPTION = "Free NHL fantasy hockey projections and tools: start/sit calls, trade analyzer, waiver wire and lineup optimizer. Works with ESPN and Yahoo leagues.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Bench Boss",
  openGraph: { type: "website", siteName: "Bench Boss", title: TITLE, description: DESCRIPTION, images: ["/logo.png"] },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/logo.png"] },
};

// Tells Google the site's name, so results read "Bench Boss" instead of the bare domain.
const SITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Bench Boss",
  alternateName: ["BenchBoss", "Bench Boss Fantasy Hockey"],
  url: `${SITE_URL}/`,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${saira.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_JSON_LD }} />
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
