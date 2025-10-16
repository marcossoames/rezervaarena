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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
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