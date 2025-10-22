import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Dumbbell } from "lucide-react";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import { openExternal } from "@/utils/openExternal";
import { FormattedDescription } from "@/components/ui/formatted-description";

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
  const [open, setOpen] = useState(false);
  
  // Build location query and URL (avoid duplicating city)
  const buildLocationQuery = () => {
    const cityTrim = (city || "").trim();
    const base = (sportsComplexAddress?.trim() || sportsComplexName.trim());
    const hasCityAlready = cityTrim
      ? base.toLowerCase().includes(cityTrim.toLowerCase())
      : true;
    const raw = hasCityAlready ? base : `${base}, ${cityTrim}`;
    return encodeURIComponent(raw);
  };
  const getMapsOpenUrl = () => {
    const q = buildLocationQuery();
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={300}>
      <HoverCardTrigger asChild onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
      }}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-[375px] p-0 z-[10000] pointer-events-auto bg-popover" 
        align="start"
        sideOffset={5}
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
                  <FormattedDescription 
                    text={sportsComplexDescription}
                    maxLength={150}
                    className="mt-2"
                  />
                )}
                {sportsComplexAddress && (
                  <a
                    href={getMapsOpenUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1 mt-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openExternal(getMapsOpenUrl());
                    }}
                  >
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-left hover:underline">{sportsComplexAddress}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 space-y-4">
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

        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
