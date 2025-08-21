import { Button } from "@/components/ui/button";
import { Search, Calendar, MapPin } from "lucide-react";
import heroImage from "@/assets/hero-sports.jpg";

const HeroSection = () => {
  return (
    <section className="relative bg-gradient-hero min-h-[600px] flex items-center">
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="Facilități sportive moderne" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-hero/60"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6">
            Rezervă-ți terenul <br />
            <span className="text-accent">perfect</span> pentru sport
          </h1>
          
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Găsește și rezervă cele mai bune facilități sportive din orașul tău. 
            Tenis, fotbal, padel, înot și multe altele.
          </p>

          <div className="bg-card/10 backdrop-blur-sm border border-primary-foreground/20 rounded-xl p-6 mb-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center space-x-2 bg-card/50 rounded-lg p-3">
                <Search className="h-5 w-5 text-primary" />
                <input 
                  placeholder="Ce sport cauți?"
                  className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground flex-1"
                />
              </div>
              
              <div className="flex items-center space-x-2 bg-card/50 rounded-lg p-3">
                <MapPin className="h-5 w-5 text-primary" />
                <input 
                  placeholder="Oraș sau zonă"
                  className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground flex-1"
                />
              </div>
              
              <div className="flex items-center space-x-2 bg-card/50 rounded-lg p-3">
                <Calendar className="h-5 w-5 text-primary" />
                <input 
                  type="date"
                  className="bg-transparent border-none outline-none text-foreground flex-1"
                />
              </div>
              
              <Button variant="sport" className="h-full">
                Caută Terenuri
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="text-lg px-8 py-6">
              Explorează Terenurile
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              Adaugă Baza Ta Sportivă
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;