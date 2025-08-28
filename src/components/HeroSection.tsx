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
          className="w-full h-full object-cover opacity-15"
          loading="eager"
          fetchPriority="high"
          width={1335}
          height={600}
          sizes="(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px"
          quality={70}
        />
        {/* Strong dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/75 to-primary-light/80"></div>
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            Rezervă-ți terenul <br />
            <span className="text-white">perfect</span> pentru sport
          </h1>
          
          <p className="text-xl text-white/95 mb-8 max-w-2xl mx-auto drop-shadow-md">
            Găsește și rezervă cele mai bune facilități sportive din orașul tău. 
            Tenis, fotbal, padel, squash, ping pong și multe altele.
          </p>


          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/facilities?from=home">
              <Button variant="hero" size="lg" className="text-lg px-8 py-6">
                Explorează Terenurile
              </Button>
            </Link>
            <Link to="/facility/login">
            <Button variant="hero" size="lg" className="text-lg px-8 py-6">
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