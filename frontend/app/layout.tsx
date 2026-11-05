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
  title: "FreightMP — ETS2 & ATS Multiplayer Hub",
  description:
    "FreightMP (FMP) — la plateforme multijoueur alternative pour Euro Truck Simulator 2 et American Truck Simulator, propulsée par FR | Industries Corporation.",
  icons: {
    icon: "/freightmp-logo.png",
    apple: "/freightmp-logo.png",
  },
  openGraph: {
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
