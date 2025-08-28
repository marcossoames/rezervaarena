import ResponsiveHeader from "@/components/ResponsiveHeader";
import ResponsiveHeroSection from "@/components/ResponsiveHeroSection";
import ResponsiveSportsSection from "@/components/ResponsiveSportsSection";
import { 
  LazySearchSection, 
  LazyFeaturesSection, 
  LazyFooter 
} from "@/components/LazyComponents";

const Index = () => {
  return (
    <div className="min-h-screen">
      <ResponsiveHeader />
      <main>
        {/* Above-the-fold content optimized for all devices */}
        <ResponsiveHeroSection />
        
        {/* Critical content loaded immediately for better UX */}
        <ResponsiveSportsSection />
        
        {/* Below-the-fold content loaded lazily */}
        <LazySearchSection />
        <LazyFeaturesSection />
      </main>
      <LazyFooter />
    </div>
  );
};

export default Index;