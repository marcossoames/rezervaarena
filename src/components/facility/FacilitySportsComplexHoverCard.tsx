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
  sportsComplexDescription?: string;
  generalServices?: string[];
  allSportsTypes: string[]; // All facility types in this complex
  city: string;
}

export const FacilitySportsComplexHoverCard = ({
  children,
  sportsComplexName,
  sportsComplexAddress,
  sportsComplexDescription,
  generalServices,
  allSportsTypes,
  city,
}: FacilitySportsComplexHoverCardProps) => {
  // Build location query and URLs (no API key needed for embed)
  const buildLocationQuery = () => {
    const raw = sportsComplexAddress
      ? `${sportsComplexAddress}, ${city}`
      : `${sportsComplexName}, ${city}`;
    return encodeURIComponent(raw);
  };

  const getMapEmbedUrl = () => {
    const q = buildLocationQuery();
    // Use output=embed to avoid API key restrictions
    return `https://www.google.com/maps?q=${q}&z=15&output=embed`;
  };

  const getMapsOpenUrl = () => {
    const q = buildLocationQuery();
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };
  return (
    <HoverCard openDelay={100} closeDelay={1500}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-96 p-0 z-[1000] pointer-events-auto" 
        align="start"
        sideOffset={2}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-t-lg border-b">
            <div className="flex items-start gap-2">
              <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-foreground leading-tight">
                  {sportsComplexName}
                </h3>
                {sportsComplexDescription && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {sportsComplexDescription}
                  </p>
                )}
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
                className="w-full h-full pointer-events-auto"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <a
              href={getMapsOpenUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-2 inline-block pointer-events-auto"
              onMouseDown={(e) => {
                e.stopPropagation();
                const url = getMapsOpenUrl();
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              Deschide în Google Maps →
            </a>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
