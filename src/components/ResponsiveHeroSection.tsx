import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const ResponsiveHeroSection = () => {
  const isMobile = useIsMobile();

  return (
    <section className="relative bg-gradient-hero min-h-[100vh] sm:min-h-[600px] flex items-center overflow-hidden">
      {/* Background Image - optimized for all devices */}
      <div className="absolute inset-0">
        <img 
          src="/src/assets/hero-sports-optimized.webp"
          alt="Facilități sportive moderne - complex sportiv cu terenuri multiple" 
          className="w-full h-full object-cover opacity-60 will-change-transform"
          loading="eager"
          fetchPriority="high"
          width={1335}
          height={600}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1335px"
        />
        {/* Enhanced gradient overlays for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/40 to-primary-light/40"></div>
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
      
      {/* Content - responsive and optimized */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Title - responsive typography */}
          <h1 className={`font-bold text-white mb-6 drop-shadow-2xl ${
            isMobile 
              ? 'text-3xl sm:text-4xl leading-tight' 
              : 'text-5xl md:text-6xl'
          }`}>
            Rezervă-ți terenul{" "}
            {isMobile ? (
              <span className="text-white block mt-2">perfect pentru sport</span>
            ) : (
              <>
                <br />
                <span className="text-white">perfect</span> pentru sport
              </>
            )}
          </h1>
          
          {/* Subtitle - optimized for readability */}
          <p className={`text-white/95 mb-8 max-w-2xl mx-auto drop-shadow-lg ${
            isMobile 
              ? 'text-lg leading-relaxed px-2' 
              : 'text-xl'
          }`}>
            Găsește și rezervă cele mai bune facilități sportive din orașul tău.{" "}
            {isMobile ? (
              <>
                <br />
                Tenis, fotbal, padel, squash și multe altele.
              </>
            ) : (
              "Tenis, fotbal, padel, squash, ping pong și multe altele."
            )}
          </p>

          {/* Action Buttons - mobile-first responsive */}
          <div className={`flex gap-4 justify-center ${
            isMobile 
              ? 'flex-col items-center space-y-4' 
              : 'flex-col sm:flex-row'
          }`}>
            <Link to="/facilities?from=home">
              <Button 
                variant="hero" 
                size={isMobile ? "default" : "lg"} 
                className={`font-semibold shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  isMobile 
                    ? 'w-full max-w-xs px-8 py-4 text-base'
                    : 'text-lg px-8 py-6'
                }`}
              >
                Explorează Terenurile
              </Button>
            </Link>
            <Link to="/facility/login">
              <Button 
                variant="hero" 
                size={isMobile ? "default" : "lg"} 
                className={`font-semibold shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  isMobile 
                    ? 'w-full max-w-xs px-8 py-4 text-base'
                    : 'text-lg px-8 py-6'
                }`}
              >
                Adaugă Baza Ta Sportivă
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll indicator for mobile */}
      {isMobile && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/60 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/60 rounded-full mt-2"></div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ResponsiveHeroSection;