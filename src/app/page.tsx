import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustSection } from "@/components/landing/TrustSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <TrustSection />
        <FeaturesSection />
      </main>
    </div>
  );
}
