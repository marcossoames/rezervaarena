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
  // Build location query and URL (avoid duplicating city)
  const buildLocationQuery = () => {
    const cityTrim = (city || "").trim();
    const base = (sportsComplexAddress?.trim() || sportsComplexName.trim());
    const hasCityAlready = cityTrim
      ? base.toLowerCase().includes(cityTrim.toLowerCase())
      : true;
    const raw = hasCityAlready ? base : `${base}, ${cityTrim}`;
    return raw.replace(/\s+/g, "+").trim();
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

          {/* Google Maps Link */}
          <div className="px-4 pb-4">
            <a
              href={getMapsOpenUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline pointer-events-auto"
              onClick={(e) => {
                // Robust open: write a tiny redirect page into the new tab
                e.preventDefault();
                const url = getMapsOpenUrl();
                const w = window.open('', '_blank');
                if (w) {
                  try {
                    const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0;url=${url}"><title>Deschidere Google Maps...</title></head><body style="font-family:system-ui,sans-serif;padding:16px;">
                    <p>Se deschide Google Maps...</p>
                    <script>window.location.replace(${JSON.stringify(url)});</script>
                    </body></html>`;
                    w.document.open();
                    w.document.write(html);
                    w.document.close();
                  } catch (_) {
                    // Fallback: navigate the current tab if popup policies interfere
                    window.location.href = url;
                  }
                } else {
                  // Last resort: navigate current tab
                  window.location.href = url;
                }
              }}
            >
              <MapPin className="h-4 w-4" />
              <span>Deschide locația în Google Maps →</span>
            </a>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
