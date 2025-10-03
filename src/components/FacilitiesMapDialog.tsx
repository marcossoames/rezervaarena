import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Facility {
  id: string;
  name: string;
  address?: string;
  city: string;
  sports_complex_name?: string;
  facility_type: string;
  price_per_hour?: number;
}

interface FacilitiesMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: Facility[];
}

const FacilitiesMapDialog = ({ open, onOpenChange, facilities }: FacilitiesMapDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFacilities, setFilteredFacilities] = useState<Facility[]>(facilities);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user's location
  useEffect(() => {
    if (open && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Error getting user location:', error);
        }
      );
    }
  }, [open]);

  // Filter facilities based on search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredFacilities(facilities);
    } else {
      const filtered = facilities.filter(f => 
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.sports_complex_name && f.sports_complex_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.address && f.address.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredFacilities(filtered);
    }
  }, [searchTerm, facilities]);

  const handleNavigate = (facility: Facility) => {
    if (!facility.address) {
      // If no address, just search by city
      const query = encodeURIComponent(`${facility.name}, ${facility.city}, Romania`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      return;
    }
    
    const query = encodeURIComponent(`${facility.address}, ${facility.city}, Romania`);
    
    // If user location is available, add origin for directions
    if (userLocation) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${query}`,
        '_blank'
      );
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const handleViewOnMap = (facility: Facility) => {
    if (!facility.address) {
      const query = encodeURIComponent(`${facility.name}, ${facility.city}, Romania`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      return;
    }
    
    const query = encodeURIComponent(`${facility.address}, ${facility.city}, Romania`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const getFacilityTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
      football: 'Fotbal',
      tennis: 'Tenis',
      padel: 'Padel',
      basketball: 'Baschet',
      volleyball: 'Volei',
      squash: 'Squash',
      foot_tennis: 'Tenis de picior',
      ping_pong: 'Ping Pong'
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Harta Facilități Sportive
          </DialogTitle>
          <DialogDescription>
            Găsește și navighează către bazele sportive din România
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <Input
            placeholder="Caută facilități după nume, oraș sau bază sportivă..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-3 pb-6">
            {filteredFacilities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nu s-au găsit facilități</p>
              </div>
            ) : (
              filteredFacilities.map((facility) => (
                <Card key={facility.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <h3 className="font-semibold text-lg truncate">{facility.name}</h3>
                          <Badge variant="outline" className="flex-shrink-0">
                            {getFacilityTypeLabel(facility.facility_type)}
                          </Badge>
                        </div>
                        
                        {facility.sports_complex_name && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {facility.sports_complex_name}
                          </p>
                        )}
                        
                        <div className="flex items-start gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-sm">
                            {facility.address ? `${facility.address}, ` : ''}{facility.city}
                          </span>
                        </div>
                        
                        {facility.price_per_hour && (
                          <p className="text-sm font-medium text-primary">
                            {facility.price_per_hour} RON/oră
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleViewOnMap(facility)}
                          size="sm"
                          variant="outline"
                          className="gap-2 whitespace-nowrap"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Vezi pe hartă
                        </Button>
                        <Button
                          onClick={() => handleNavigate(facility)}
                          size="sm"
                          className="gap-2 whitespace-nowrap"
                        >
                          <Navigation className="h-4 w-4" />
                          Navigație
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {userLocation && (
          <div className="px-6 py-3 bg-muted/50 text-xs text-muted-foreground border-t">
            💡 Locația ta a fost detectată - butonul "Navigație" va deschide Google Maps cu indicații de la poziția ta curentă
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FacilitiesMapDialog;
