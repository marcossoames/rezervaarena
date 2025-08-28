import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

// Sports data with optimized images
const tennisImage = "/placeholder-tennis.jpg";
const footballImage = "/placeholder-football.jpg"; 
const padelImage = "/placeholder-padel.jpg";
const squashImage = "/placeholder-squash.jpg";
const basketballImage = "/placeholder-basketball.jpg";
const volleyballImage = "/placeholder-volleyball.jpg";
const pingPongImage = "/placeholder-ping-pong.jpg";
const footTennisImage = "/placeholder-foot-tennis.jpg";
const swimmingImage = "/placeholder-swimming.jpg";

interface SportData {
  id: number;
  name: string;
  type: string;
  image: string;
  description: string;
  facilities: number;
  minPrice: string;
}

const initialSportsData = [
  {
    id: 1,
    name: "Fotbal",
    type: "football",
    image: footballImage,
    description: "Terenuri de fotbal cu gazon sintetic și natural",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 2,
    name: "Tenis",
    type: "tennis",
    image: tennisImage,
    description: "Terenuri profesionale de tenis cu suprafețe moderne",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 3,
    name: "Padel",
    type: "padel",
    image: padelImage,
    description: "Terenuri moderne de padel cu echipament complet",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 4,
    name: "Squash",
    type: "squash",
    image: squashImage,
    description: "Terenuri moderne de squash pentru antrenament și competiții",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 5,
    name: "Baschet",
    type: "basketball",
    image: basketballImage,
    description: "Terenuri moderne de baschet cu echipament profesional",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 6,
    name: "Volei",
    type: "volleyball",
    image: volleyballImage,
    description: "Terenuri de volei pentru competiții și antrenamente",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 7,
    name: "Înot",
    type: "swimming",
    image: swimmingImage,
    description: "Piscine profesionale pentru înot și sporturi acvatice",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 8,
    name: "Tenis de Picior",
    type: "foot_tennis",
    image: footTennisImage,
    description: "Terenuri de tenis de picior pentru jocuri dinamice și distractive",
    facilities: 0,
    minPrice: "0 RON/oră"
  },
  {
    id: 9,
    name: "Ping Pong",
    type: "ping_pong",
    image: pingPongImage,
    description: "Mese profesionale de tenis de masă pentru toate nivelurile",
    facilities: 0,
    minPrice: "0 RON/oră"
  }
];

const ResponsiveSportsSection = () => {
  const isMobile = useIsMobile();
  const [sportsData, setSportsData] = useState(initialSportsData);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchSportsData = async () => {
      try {
        const { data, error } = await supabase.rpc('get_facility_stats_by_type');
        if (error) {
          console.debug('Error fetching facility stats:', error);
          setIsLoading(false);
          return;
        }

        // Create a map for easy lookup
        const statsMap: Record<string, { count: number; minPrice: number }> = {};
        data?.forEach((stat: any) => {
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
        setIsLoading(false);
      } catch (error) {
        console.debug('Error fetching sports data:', error);
        setIsLoading(false);
      }
    };
    
    fetchSportsData();
  }, []);

  return (
    <section id="terenuri" className="py-12 sm:py-16 lg:py-20 bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section - responsive */}
        <div className="text-center mb-12 lg:mb-16">
          <h2 className={`font-bold text-foreground mb-4 ${
            isMobile ? 'text-3xl' : 'text-4xl lg:text-5xl'
          }`}>
            Tipuri de <span className="text-primary">Terenuri Sportive</span>
          </h2>
          <p className={`text-muted-foreground max-w-2xl mx-auto ${
            isMobile ? 'text-lg px-4' : 'text-xl'
          }`}>
            Descoperă varietatea de facilități sportive disponibile pentru rezervare pe site-ul nostru!
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Se încarcă terenurile...</p>
          </div>
        )}

        {/* Sports Grid - responsive layout */}
        <div className={`grid gap-6 lg:gap-8 ${
          isMobile 
            ? 'grid-cols-1' 
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {sportsData.map(sport => (
            <Card 
              key={sport.id} 
              className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-card border-none overflow-hidden card-optimized will-change-transform"
            >
              <CardContent className="p-0">
                {/* Image Section - optimized for performance */}
                <div className="relative overflow-hidden">
                  <img 
                    src={sport.image} 
                    alt={`Teren de ${sport.name} - facilități sportive moderne`}
                    className={`w-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                      isMobile ? 'h-48' : 'h-52 lg:h-56'
                    }`}
                    loading="lazy"
                    width={400}
                    height={isMobile ? 192 : 224}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.backgroundColor = 'hsl(var(--muted))';
                      target.style.minHeight = isMobile ? '192px' : '224px';
                    }}
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                  
                  {/* Sport Type Badge */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className={`font-bold text-white drop-shadow-lg ${
                      isMobile ? 'text-lg' : 'text-xl'
                    }`}>
                      {sport.name}
                    </h3>
                    <span className="text-sm text-white/90 capitalize">
                      {sport.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                {/* Content Section */}
                <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
                  {/* Description */}
                  <p className={`text-muted-foreground mb-4 ${
                    isMobile ? 'text-sm' : 'text-base'
                  }`}>
                    {sport.description}
                  </p>
                  
                  {/* Stats */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Terenuri disponibile:</span>
                      <span className="font-semibold text-primary">
                        {sport.facilities}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">De la:</span>
                      <span className="font-semibold text-accent">
                        {sport.minPrice}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <Link to={`/facilities?type=${sport.type}`}>
                    <Button 
                      className={`w-full font-medium transition-all duration-300 hover:shadow-lg ${
                        isMobile ? 'py-3' : 'py-3'
                      }`} 
                      variant="default"
                    >
                      Vezi Terenurile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ResponsiveSportsSection;