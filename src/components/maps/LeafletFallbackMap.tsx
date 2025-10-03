// @ts-nocheck
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export interface FacilityWithCoords {
  id: string;
  name: string;
  address?: string;
  city: string;
  sports_complex_name?: string;
  facility_type: string;
  price_per_hour?: number;
  lat: number;
  lng: number;
}

interface LeafletFallbackMapProps {
  center: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
  facilities: FacilityWithCoords[];
  onNavigate: (f: FacilityWithCoords) => void;
  getFacilityTypeLabel: (t: string) => string;
}

const LeafletFallbackMap: React.FC<LeafletFallbackMapProps> = ({
  center,
  userLocation,
  facilities,
  onNavigate,
  getFacilityTypeLabel,
}) => {
  return (
    // @ts-ignore - react-leaflet types can be finicky in some setups
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={userLocation ? 12 : 7}
      style={{ height: '100%', width: '100%' }}
    >
      {/* @ts-ignore */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {userLocation && (
        // @ts-ignore
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1 }}
        />
      )}

      {facilities.map((facility) => (
        // @ts-ignore
        <Marker key={facility.id} position={[facility.lat, facility.lng]}>
          {/* @ts-ignore */}
          <Popup>
            <div className="p-2 max-w-xs">
              <div className="flex items-start gap-2 mb-2">
                <h3 className="font-semibold text-base">{facility.name}</h3>
                <Badge variant="outline" className="flex-shrink-0 text-xs">
                  {getFacilityTypeLabel(facility.facility_type)}
                </Badge>
              </div>
              {facility.sports_complex_name && (
                <p className="text-xs text-gray-600 mb-2">{facility.sports_complex_name}</p>
              )}
              <div className="flex items-start gap-1 mb-2">
                <MapPin className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-700">
                  {facility.address}, {facility.city}
                </span>
              </div>
              {facility.price_per_hour && (
                <p className="text-sm font-medium text-primary mb-3">
                  {facility.price_per_hour} RON/oră
                </p>
              )}
              <Button onClick={() => onNavigate(facility)} size="sm" className="w-full gap-2">
                <Navigation className="h-3 w-3" />
                Navigație Google Maps
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default LeafletFallbackMap;
