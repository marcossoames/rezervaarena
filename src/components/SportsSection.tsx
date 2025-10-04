import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import footballFieldSyntetic from "@/assets/football-field-synthetic-indoor.jpg";

// Debug logging for missing images
console.log('Checking image imports...');

// Temporary placeholder until we add real images
const footballImage = footballFieldSyntetic;
const tennisImage = "/placeholder-tennis-modern.jpg";
const padelImage = "/placeholder-padel.jpg";
const squashImage = "/placeholder-squash.jpg";
const basketballImage = "/placeholder-basketball.jpg";
const volleyballImage = "/placeholder-volleyball.jpg";
const pingPongImage = "/placeholder-ping-pong.jpg";
const footTennisImage = "/placeholder-foot-tennis.jpg";

console.log('Tennis image path:', tennisImage);
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
  description: "Descoperă terenuri de fotbal premium cu gazon sintetic de ultimă generație și natural întreținut profesional. Perfecte pentru meciuri competitive, antrenamente intensive sau simple jocuri recreative cu prietenii în condiții optime.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 2,
  name: "Tenis",
  type: "tennis",
  image: tennisImage,
  description: "Terenuri profesionale de tenis cu suprafețe moderne - zgură, hard court și sintetic. Iluminare LED performantă pentru jocuri de seară, fileu profesional și linii marcate conform standardelor ITF. Ideal pentru turnee, antrenamente și lecții.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 3,
  name: "Padel",
  type: "padel",
  image: padelImage,
  description: "Terenuri moderne de padel cu pereți din sticlă securizată și gazon sintetic premium. Echipament complet disponibil pentru închiriere, vestiare amenajate și zone de relaxare. Sportul cu cea mai rapidă creștere în popularitate!",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 4,
  name: "Squash",
  type: "squash",
  image: squashImage,
  description: "Terenuri indoor de squash cu pereți profesionali, podea specială anti-alunecare și climat controlat. Excelente pentru cardio intens, antrenament competitiv sau partide relaxante. Mingi și rachete disponibile la locație.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 5,
  name: "Baschet",
  type: "basketball",
  image: basketballImage,
  description: "Terenuri de baschet indoor și outdoor cu coșuri profesionale reglabile, marcaje oficiale FIBA și suprafețe anti-alunecare. Perfect pentru meciuri 3x3, 5x5, antrenamente individuale sau turnee organizate cu prietenii.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 6,
  name: "Volei",
  type: "volleyball",
  image: volleyballImage,
  description: "Terenuri de volei indoor cu fileu reglabil, pardoseală profesională amortizată și spații generoase. Posibilitate rezervare pentru volei în sală sau beach volley pe nisip fin. Atmosferă ideală pentru competiții și antrenamente de echipă.",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 7,
  name: "Tenis de Picior",
  type: "foot_tennis",
  image: footTennisImage,
  description: "Terenuri special amenajate pentru tenis de picior - combinația perfectă între fotbal și tenis. Suprafață sintetică de calitate, fileu la înălțime optimă și dimensiuni standardizate. Sportul ideal pentru agilitate, tehnică și distracție maximă!",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 8,
  name: "Ping Pong",
  type: "ping_pong",
  image: pingPongImage,
  description: "Mese profesionale de tenis de masă în spații indoor climatizate, conforme standardelor ITTF. Palete și mingi de calitate disponibile, podea anti-alunecare și iluminare LED fără umbre. Pentru toate nivelurile de joc, de la începători la avansați.",
  facilities: 0,
  minPrice: "0 RON/oră"
}];
const SportsSection = () => {
  const [sportsData, setSportsData] = useState<SportData[]>(initialSportsData);
  
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
  return <section id="terenuri" className="pt-8 pb-16 bg-gradient-to-br from-secondary/10 via-background to-primary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-foreground mb-3">
            Tipuri de <span className="text-primary">Terenuri Sportive</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Descoperă varietatea de facilități sportive disponibile pentru rezervare pe site-ul nostru!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sportsData.map(sport => <Card key={sport.id} className="group hover:shadow-elegant transition-all duration-300 transform hover:scale-[1.02] bg-gradient-card border-none flex flex-col h-full overflow-hidden">
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