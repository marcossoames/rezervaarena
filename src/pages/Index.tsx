import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import { 
  LazySearchSection, 
  LazySportsSection, 
  LazyFeaturesSection, 
  LazyFooter 
} from "@/components/LazyComponents";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-[calc(env(safe-area-inset-top)+4rem)]">
        {/* Above-the-fold content loaded immediately */}
        <HeroSection />
        
        {/* Below-the-fold content loaded lazily to reduce initial bundle */}
        <LazySearchSection />
        <LazySportsSection />
        <LazyFeaturesSection />
      </main>
      <LazyFooter />
    </div>
  );
};

export default Index;