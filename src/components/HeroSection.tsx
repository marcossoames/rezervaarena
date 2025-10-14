import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { OptimizedImage } from "@/components/ui/optimized-image";
import heroImage from "@/assets/hero-sports.jpg";

const HeroSection = () => {
  return (
    <section className="relative bg-gradient-hero min-h-[600px] flex items-center">
      <div className="absolute inset-0">
        <OptimizedImage 
          src={heroImage} 
          alt="Facilități sportive moderne" 
          className="w-full h-full object-cover opacity-20"
          loading="eager"
          fetchPriority="high"
          width={1335}
          height={600}
          sizes="(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px"
          quality={70}
        />
        <div className="absolute inset-0 bg-gradient-hero/60"></div>
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary-foreground mb-4 sm:mb-6 px-2">
            Rezervă-ți terenul <br />
            <span className="text-primary-foreground">perfect</span> pentru sport
          </h1>
          
          <p className="text-lg sm:text-xl text-primary-foreground/90 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Găsește și rezervă cele mai bune facilități sportive din orașul tău. 
            Tenis, fotbal, padel, squash, ping pong și multe altele.
          </p>


          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link to="/facilities?from=home" className="w-full sm:w-auto">
              <Button variant="hero" size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 min-h-[48px]">
                Explorează Terenurile
              </Button>
            </Link>
            <Link to="/facility/login" className="w-full sm:w-auto">
            <Button variant="hero" size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 min-h-[48px]">
              Adaugă Baza Ta Sportivă
            </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;