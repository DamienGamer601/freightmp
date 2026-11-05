import Hero from "@/components/Hero";
import ServerStatus from "@/components/ServerStatus";
import Announcements from "@/components/Announcements";
import Features from "@/components/Features";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServerStatus />
      <Announcements />
      <Features />
    </>
  );
}
