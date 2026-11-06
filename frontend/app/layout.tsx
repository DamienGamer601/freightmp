import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://freightmp.vercel.app",
  ),
  title: {
    default: "FreightMP — ETS2 & ATS Multiplayer Hub",
    template: "%s · FreightMP",
  },
  description:
    "FreightMP (FMP) — la plateforme multijoueur alternative pour Euro Truck Simulator 2 et American Truck Simulator, propulsée par FR | Industries Corporation.",
  icons: {
    icon: "/freightmp-logo.png",
    apple: "/freightmp-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "FreightMP",
    title: "FreightMP — ETS2 & ATS Multiplayer Hub",
    description:
      "La plateforme multijoueur alternative pour Euro Truck Simulator 2 et American Truck Simulator.",
    images: [{ url: "/freightmp-banner.png", width: 1920, height: 1080, alt: "FreightMP" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreightMP — ETS2 & ATS Multiplayer Hub",
    description:
      "La plateforme multijoueur alternative pour Euro Truck Simulator 2 et American Truck Simulator.",
    images: ["/freightmp-banner.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-charbon-950 font-sans text-zinc-300 antialiased">
        <ScrollReveal />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
