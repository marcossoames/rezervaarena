import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, X } from 'lucide-react';
import { toast } from "sonner";

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Get user's location
  useEffect(() => {
    if (open && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.log('Error getting user location:', error);
        }
      );
    }
  }, [open]);

  // Geocode address to coordinates
  const geocodeAddress = async (address: string, city: string, token: string): Promise<[number, number] | null> => {
    try {
      const query = encodeURIComponent(`${address}, ${city}, Romania`);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=RO&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].center as [number, number];
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainer.current || !mapboxToken) return;

    // Clean up existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Initialize map
    mapboxgl.accessToken = mapboxToken;
    
    const initialCenter: [number, number] = userLocation || [26.1025, 44.4268]; // Default to Bucharest
    const initialZoom = userLocation ? 12 : 6;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add user location marker if available
    if (userLocation) {
      const userMarker = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(userLocation)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Locația ta</strong>'))
        .addTo(map.current);
      markersRef.current.push(userMarker);
    }

    // Add facility markers
    const addFacilityMarkers = async () => {
      if (!map.current) return;

      for (const facility of facilities) {
        if (!facility.address) continue; // Skip facilities without address
        const coords = await geocodeAddress(facility.address, facility.city, mapboxToken);
        if (coords && map.current) {
          const el = document.createElement('div');
          el.className = 'facility-marker';
          el.style.width = '30px';
          el.style.height = '30px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#10b981';
          el.style.border = '3px solid white';
          el.style.cursor = 'pointer';
          el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

          const marker = new mapboxgl.Marker(el)
            .setLngLat(coords)
            .addTo(map.current);

          el.addEventListener('click', () => {
            setSelectedFacility(facility);
          });

          markersRef.current.push(marker);
        }
      }
    };

    addFacilityMarkers();

    // Cleanup
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [open, mapboxToken, facilities, userLocation]);

  const handleNavigate = (facility: Facility) => {
    const query = encodeURIComponent(`${facility.address}, ${facility.city}, Romania`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Hartă Facilități Sportive
          </DialogTitle>
          <DialogDescription>
            Descoperă toate bazele sportive din România
          </DialogDescription>
        </DialogHeader>

        {!mapboxToken ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Pentru a folosi harta, introdu token-ul tău public Mapbox:
            </p>
            <input
              type="text"
              placeholder="pk.eyJ1..."
              className="w-full px-3 py-2 border rounded-md"
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Găsește token-ul tău pe{' '}
              <a
                href="https://account.mapbox.com/access-tokens/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                mapbox.com
              </a>
            </p>
          </div>
        ) : (
          <div className="flex-1 relative">
            <div ref={mapContainer} className="absolute inset-0 rounded-b-lg" />
            
            {selectedFacility && (
              <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10">
                <button
                  onClick={() => setSelectedFacility(null)}
                  className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
                
                <h3 className="font-semibold text-lg mb-1">{selectedFacility.name}</h3>
                {selectedFacility.sports_complex_name && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedFacility.sports_complex_name}
                  </p>
                )}
                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{selectedFacility.address}, {selectedFacility.city}</span>
                </div>
                <div className="flex items-center justify-between">
                  {selectedFacility.price_per_hour && (
                    <span className="text-sm font-medium">
                      {selectedFacility.price_per_hour} RON/oră
                    </span>
                  )}
                  <Button
                    onClick={() => handleNavigate(selectedFacility)}
                    size="sm"
                    className="gap-2"
                  >
                    <Navigation className="h-4 w-4" />
                    Navigație
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FacilitiesMapDialog;
