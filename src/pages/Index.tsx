import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import SportsSection from "@/components/SportsSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <SportsSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;