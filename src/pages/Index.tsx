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
      <main>
        <HeroSection />
        <LazySearchSection />
        <LazySportsSection />
        <LazyFeaturesSection />
      </main>
      <LazyFooter />
    </div>
  );
};

export default Index;