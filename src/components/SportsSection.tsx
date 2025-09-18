import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Debug logging for missing images
console.log('Checking image imports...');

// Temporary placeholder until we add real images
const footballImage = "/placeholder-football-synthetic-interior.jpg";
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
  description: "Terenuri de fotbal cu gazon sintetic și natural",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 2,
  name: "Tenis",
  type: "tennis",
  image: tennisImage,
  description: "Terenuri profesionale de tenis cu suprafețe moderne",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 3,
  name: "Padel",
  type: "padel",
  image: padelImage,
  description: "Terenuri moderne de padel cu echipament complet",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 4,
  name: "Squash",
  type: "squash",
  image: squashImage,
  description: "Terenuri moderne de squash pentru antrenament și competiții",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 5,
  name: "Baschet",
  type: "basketball",
  image: basketballImage,
  description: "Terenuri moderne de baschet cu echipament profesional",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 6,
  name: "Volei",
  type: "volleyball",
  image: volleyballImage,
  description: "Terenuri de volei pentru competiții și antrenamente",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 7,
  name: "Tenis de Picior",
  type: "foot_tennis",
  image: footTennisImage,
  description: "Terenuri de tenis de picior pentru jocuri dinamice și distractive",
  facilities: 0,
  minPrice: "0 RON/oră"
}, {
  id: 8,
  name: "Ping Pong",
  type: "ping_pong",
  image: pingPongImage,
  description: "Mese profesionale de tenis de masă pentru toate nivelurile",
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
  return <section id="terenuri" className="pt-8 pb-20 bg-gradient-to-br from-secondary/10 via-background to-primary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Tipuri de <span className="text-primary">Terenuri Sportive</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Descoperă varietatea de facilități sportive disponibile pentru rezervare pe site-ul nostru!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sportsData.map(sport => <Card key={sport.id} className="group hover:shadow-elegant transition-all duration-300 transform hover:scale-105 bg-gradient-card border-none flex flex-col h-full">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="relative overflow-hidden rounded-t-lg">
                  <OptimizedImage 
                    src={sport.image} 
                    alt={sport.name} 
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300" 
                    loading="lazy" 
                    width={395} 
                    height={192}
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 395px" 
                    quality={70}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-xl font-bold text-primary-foreground">{sport.name}</h3>
                  </div>
                </div>
                
                <div className="p-6 flex flex-col h-full">
                  <p className="text-sm text-muted-foreground mb-4 flex-grow">{sport.description}</p>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Terenuri disponibile:</span>
                      <span className="font-semibold text-primary">{sport.facilities}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">De la:</span>
                      <span className="font-semibold text-accent">{sport.minPrice}</span>
                    </div>
                  </div>
                  
                  <Link to={`/facilities?type=${sport.type}`} className="mt-auto">
                    <Button className="w-full" variant="default">
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