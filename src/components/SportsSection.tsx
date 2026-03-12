import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { supabase } from "@/integrations/supabase/client";
import footballFieldSyntetic from "@/assets/football-field-synthetic-indoor.jpg";

const footballImage = footballFieldSyntetic;
const tennisImage = "/placeholder-tennis-modern.jpg";
const padelImage = "/placeholder-padel.jpg";
const squashImage = "/placeholder-squash.jpg";
const basketballImage = "/placeholder-basketball.jpg";
const volleyballImage = "/placeholder-volleyball.jpg";
const pingPongImage = "/placeholder-ping-pong.jpg";
const footTennisImage = "/placeholder-foot-tennis.jpg";

interface SportData {
  id: number;
  name: string;
  type: string;
  image: string;
  description: string;
  facilities: number;
  minPrice: string;
}
const initialSportsData = [{
  id: 1,
  name: "Fotbal",
  type: "football",
  image: footballImage,
  description: "Terenuri de fotbal moderne, cu gazon sintetic, în exterior sau în balon. Condiții optime tot anul. Perfecte pentru meciuri cu prietenii sau antrenamente.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 2,
  name: "Tenis",
  type: "tennis",
  image: tennisImage,
  description: "Terenuri de tenis cu suprafețe variate - zgură, hard și sintetic.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 3,
  name: "Padel",
  type: "padel",
  image: padelImage,
  description: "Terenuri moderne de padel cu pereți din sticlă. Echipament disponibil pentru închiriere. Sportul momentului!",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 4,
  name: "Squash",
  type: "squash",
  image: squashImage,
  description: "Terenuri indoor de squash cu climat controlat și suprafețe anti-alunecare. Excelent pentru cardio intens sau partide relaxante.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 5,
  name: "Baschet",
  type: "basketball",
  image: basketballImage,
  description: "Terenuri de baschet indoor și outdoor cu coșuri reglabile și marcaje oficiale. Ideal pentru 3x3, 5x5 sau antrenamente individuale.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 6,
  name: "Volei",
  type: "volleyball",
  image: volleyballImage,
  description: "Terenuri de volei în sală, perfecte pentru meciuri de echipă și antrenamente.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 7,
  name: "Tenis de Picior",
  type: "foot_tennis",
  image: footTennisImage,
  description: "Combinația perfectă între fotbal și tenis! Suprafață sintetică de calitate și fileu la înălțime optimă. Distracție garantată!",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 8,
  name: "Ping Pong",
  type: "ping_pong",
  image: pingPongImage,
  description: "Mese de tenis în interior. Palete și mingi disponibile. Pentru toate nivelurile - de la începători la avansați.",
  facilities: 0,
  minPrice: "0 RON/oră"
}];
const SportsSection = () => {
  const [sportsData, setSportsData] = useState<SportData[]>(initialSportsData);
  const { ref: sectionRef, isVisible } = useScrollAnimation(0.05);
  
  useEffect(() => {
    const fetchSportsData = async () => {
      try {
        // Try to get cached data first to reduce request chain delays
        const { getCachedFacilityStats } = await import('@/hooks/useCriticalDataPreloader');
        const cachedStats = getCachedFacilityStats();
        
        let facilityStats;
        
        if (cachedStats) {
          // Use cached data if available
          facilityStats = cachedStats;
        } else {
          // Fallback to direct API call if cache miss
          const { data, error } = await supabase.rpc('get_facility_stats_by_type');
          if (error) {
            // Log error silently without showing toast notifications
            console.debug('Error fetching facility stats:', error);
            return;
          }
          facilityStats = data;
        }

        // Create a map for easy lookup
        const statsMap: Record<string, { count: number; minPrice: number }> = {};
        facilityStats?.forEach((stat: any) => {
          statsMap[stat.facility_type] = {
            count: Number(stat.facility_count),
            minPrice: Number(stat.min_price)
          };
        });

        // Update sports data with real stats
        const updatedSportsData = initialSportsData.map(sport => {
          const sportStats = statsMap[sport.type];
          if (sportStats) {
            return {
              ...sport,
              facilities: sportStats.count,
              minPrice: `${sportStats.minPrice} RON/oră`
            };
          }
          return sport;
        });
        
        setSportsData(updatedSportsData);
      } catch (error) {
        // Log error silently without showing toast notifications
        console.debug('Error fetching sports data:', error);
      }
    };
    
    fetchSportsData();
  }, []);
  return <section id="terenuri" className="pt-6 sm:pt-8 pb-12 sm:pb-16 bg-gradient-to-br from-secondary/10 via-background to-primary/5">
      <div className="container mx-auto px-4 sm:px-6" ref={sectionRef}>
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3">
            Tipuri de <span className="text-primary">Terenuri Sportive</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Descoperă varietatea de facilități sportive disponibile pentru rezervare pe site-ul nostru!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sportsData.map((sport, index) => <Card key={sport.id} className={`group hover-lift bg-gradient-card border-none flex flex-col h-full overflow-hidden animate-on-scroll ${isVisible ? 'visible' : ''} stagger-${index + 1}`}>
              <CardContent className="p-0 flex flex-col h-full">
                <div className="relative overflow-hidden bg-muted">
                  <OptimizedImage 
                    src={sport.image} 
                    alt={sport.name} 
                    className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500" 
                    loading="lazy" 
                    width={395} 
                    height={224}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 395px" 
                    quality={80}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-3 left-4">
                    <h3 className="text-2xl font-bold text-primary-foreground drop-shadow-lg">{sport.name}</h3>
                  </div>
                </div>
                
                <div className="p-4 flex flex-col flex-grow">
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed line-clamp-4">{sport.description}</p>
                  
                  <div className="space-y-1.5 mb-3 mt-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Terenuri disponibile:</span>
                      <span className="font-bold text-lg text-primary">{sport.facilities}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">De la:</span>
                      <span className="font-bold text-lg text-accent">{sport.minPrice}</span>
                    </div>
                  </div>
                  
                  <Link to={`/facilities?type=${sport.type}`} className="mt-2">
                    <Button className="w-full" variant="default" size="lg">
                      Rezervă Acum
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>)}
        </div>
      </div>
    </section>;
};
export default SportsSection;