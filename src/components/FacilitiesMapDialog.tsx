import React, { useState, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import LeafletFallbackMap, { FacilityWithCoords as LeafletFacility } from '@/components/maps/LeafletFallbackMap';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

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

interface FacilityWithCoords extends Facility {
  lat: number;
  lng: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 44.4268,
  lng: 26.1025, // Bucharest, Romania
};

const GOOGLE_MAPS_API_KEY = 'AIzaSyCUJfYBXXKM3quBv6rKU9KK8HrM63yfANw';

const FacilitiesMapDialog = ({ open, onOpenChange, facilities }: FacilitiesMapDialogProps) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [facilitiesWithCoords, setFacilitiesWithCoords] = useState<FacilityWithCoords[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithCoords | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const mapOptions = useMemo(() => ({
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
  }), []);

  // Get user's location
  useEffect(() => {
    if (open && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setMapCenter(location);
        },
        (error) => {
          console.log('Error getting user location:', error);
        }
      );
    }
  }, [open]);

  // Geocode facilities when dialog opens and API is loaded
  useEffect(() => {
    if (!open || !isLoaded) return;

    const geocodeFacilities = async () => {
      setIsGeocoding(true);
      const geocodedFacilities: FacilityWithCoords[] = [];

      for (const facility of facilities) {
        if (!facility.address) continue;

        try {
          const query = encodeURIComponent(`${facility.address}, ${facility.city}, Romania`);
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GOOGLE_MAPS_API_KEY}`
          );
          const data = await response.json();

          if (data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            geocodedFacilities.push({
              ...facility,
              lat: location.lat,
              lng: location.lng,
            });
          }
        } catch (error) {
          console.error('Geocoding error for facility:', facility.name, error);
        }
      }

      setFacilitiesWithCoords(geocodedFacilities);
      setIsGeocoding(false);

      // Center map on first facility or keep user location
      if (geocodedFacilities.length > 0 && !userLocation) {
        setMapCenter({
          lat: geocodedFacilities[0].lat,
          lng: geocodedFacilities[0].lng,
        });
      }
    };

    geocodeFacilities();
  }, [facilities, open, userLocation, isLoaded]);

  // Fallback geocoding with OpenStreetMap when Google Maps fails to load
  useEffect(() => {
    if (!open || !loadError) return;

    const geocodeFacilitiesOSM = async () => {
      setIsGeocoding(true);
      const geocoded: FacilityWithCoords[] = [];
      for (const facility of facilities) {
        if (!facility.address) continue;
        try {
          const query = encodeURIComponent(`${facility.address}, ${facility.city}, Romania`);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`);
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > 0) {
            geocoded.push({ ...facility, lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) });
          }
        } catch (e) {
          console.error('OSM geocoding error for facility:', facility.name, e);
        }
      }
      setFacilitiesWithCoords(geocoded);
      setIsGeocoding(false);
      if (geocoded.length > 0 && !userLocation) {
        setMapCenter({ lat: geocoded[0].lat, lng: geocoded[0].lng });
      }
    };

    geocodeFacilitiesOSM();
  }, [open, loadError, facilities, userLocation]);

  const handleNavigate = (facility: FacilityWithCoords) => {
    if (!facility.address) return;
    const query = encodeURIComponent(`${facility.address}, ${facility.city}, Romania`);
    if (userLocation) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${query}`,
        '_blank'
      );
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
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
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Hartă Facilități Sportive
          </DialogTitle>
          <DialogDescription>
            Descoperă toate bazele sportive din România pe hartă
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-destructive">Eroare la încărcarea hărții</p>
              <p className="text-xs text-muted-foreground mt-2">
                {(loadError as any)?.message || 'Verifică restricțiile cheii și API-urile activate (Maps JavaScript API, Geocoding API).'}
              </p>
            </div>
          </div>
        ) : !isLoaded || isGeocoding ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                {isGeocoding ? 'Se încarcă locațiile pe hartă...' : 'Se încarcă harta...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 relative">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={userLocation ? 12 : 7}
              options={mapOptions}
            >
              {/* User location marker */}
              {userLocation && (
                <Marker
                  position={userLocation}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                  title="Locația ta"
                />
              )}

              {/* Facility markers */}
              {facilitiesWithCoords.map((facility) => (
                <Marker
                  key={facility.id}
                  position={{ lat: facility.lat, lng: facility.lng }}
                  onClick={() => setSelectedFacility(facility)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#10b981',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                />
              ))}

              {/* Info window for selected facility */}
              {selectedFacility && (
                <InfoWindow
                  position={{ lat: selectedFacility.lat, lng: selectedFacility.lng }}
                  onCloseClick={() => setSelectedFacility(null)}
                >
                  <div className="p-2 max-w-xs">
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="font-semibold text-base">{selectedFacility.name}</h3>
                      <Badge variant="outline" className="flex-shrink-0 text-xs">
                        {getFacilityTypeLabel(selectedFacility.facility_type)}
                      </Badge>
                    </div>

                    {selectedFacility.sports_complex_name && (
                      <p className="text-xs text-gray-600 mb-2">
                        {selectedFacility.sports_complex_name}
                      </p>
                    )}

                    <div className="flex items-start gap-1 mb-2">
                      <MapPin className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-gray-700">
                        {selectedFacility.address}, {selectedFacility.city}
                      </span>
                    </div>

                    {selectedFacility.price_per_hour && (
                      <p className="text-sm font-medium text-primary mb-3">
                        {selectedFacility.price_per_hour} RON/oră
                      </p>
                    )}

                    <Button
                      onClick={() => handleNavigate(selectedFacility)}
                      size="sm"
                      className="w-full gap-2"
                    >
                      <Navigation className="h-3 w-3" />
                      Navigație Google Maps
                    </Button>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </div>
        )}

        {!isGeocoding && (
          <div className="px-6 py-3 bg-muted/50 text-xs text-muted-foreground border-t">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#10b981] border-2 border-white"></div>
                <span>Facilități sportive</span>
              </div>
              {userLocation && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#3b82f6] border-2 border-white"></div>
                  <span>Locația ta</span>
                </div>
              )}
              <span className="ml-auto">
                {facilitiesWithCoords.length} locații afișate
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FacilitiesMapDialog;
