import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Dumbbell } from "lucide-react";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";

interface FacilitySportsComplexHoverCardProps {
  children: React.ReactNode;
  sportsComplexName: string;
  sportsComplexAddress?: string;
  generalServices?: string[];
  allSportsTypes: string[]; // All facility types in this complex
  city: string;
}

export const FacilitySportsComplexHoverCard = ({
  children,
  sportsComplexName,
  sportsComplexAddress,
  generalServices,
  allSportsTypes,
  city,
}: FacilitySportsComplexHoverCardProps) => {
  // Generate Google Maps embed URL
  const getMapEmbedUrl = () => {
    const searchQuery = sportsComplexAddress 
      ? encodeURIComponent(sportsComplexAddress)
      : encodeURIComponent(`${sportsComplexName}, ${city}`);
    
    return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${searchQuery}&zoom=15`;
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-96 p-0 z-[1000]" 
        align="start"
        sideOffset={5}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-t-lg border-b">
            <div className="flex items-start gap-2">
              <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-lg text-foreground leading-tight">
                  {sportsComplexName}
                </h3>
                {sportsComplexAddress && (
                  <div className="flex items-start gap-1 mt-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-left">{sportsComplexAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 space-y-4">
            {/* Sports Types Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Sporturi disponibile
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {allSportsTypes.length > 0 ? (
                  allSportsTypes.map((type) => (
                    <Badge 
                      key={type} 
                      variant="default"
                      className="text-xs"
                    >
                      {getFacilityTypeLabel(type)}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Detalii în curs de actualizare
                  </p>
                )}
              </div>
            </div>

            {/* General Services Section */}
            {generalServices && generalServices.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  Servicii generale
                </p>
                <div className="flex flex-wrap gap-2">
                  {generalServices.map((service) => (
                    <Badge 
                      key={service} 
                      variant="outline"
                      className="text-xs"
                    >
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Google Maps Section */}
          <div className="px-4 pb-4">
            <p className="text-sm font-semibold text-foreground mb-2">
              Locație
            </p>
            <div className="relative w-full h-40 rounded-lg overflow-hidden border bg-muted">
              <iframe
                title={`Harta pentru ${sportsComplexName}`}
                src={getMapEmbedUrl()}
                className="w-full h-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${
                sportsComplexAddress 
                  ? encodeURIComponent(sportsComplexAddress)
                  : encodeURIComponent(`${sportsComplexName}, ${city}`)
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              Deschide în Google Maps →
            </a>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
