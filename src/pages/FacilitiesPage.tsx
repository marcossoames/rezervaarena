import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Star, Filter, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Facility {
  id: string;
  name: string;
  description: string | null;
  facility_type: string;
  address: string;
  city: string;
  price_per_hour: number;
  capacity: number;
  amenities: string[] | null;
  images: string[] | null;
  is_active: boolean;
}

const FacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const { data, error } = await supabase
          .from('facilities')
          .select('*')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching facilities:', error);
        } else {
          setFacilities(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFacilities();
  }, []);

  const getFacilityTypeLabel = (type: string) => {
    const typeMap: { [key: string]: string } = {
      tennis: "Tenis",
      football: "Fotbal", 
      padel: "Padel",
      swimming: "Înot",
      basketball: "Baschet",
      volleyball: "Volei"
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">Se încarcă facilitățile...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Facilități <span className="text-primary">Sportive</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Descoperă cele mai bune baze sportive din București și rezervă acum
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 animate-fade-in">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Caută facilități..." className="pl-10" />
              </div>
              
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Locație..." className="pl-10" />
              </div>
              
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="date" className="pl-10" />
              </div>
              
              <Button variant="sport" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Filtrează
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Toate</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Tenis</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Fotbal</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Padel</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Înot</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Facilities Grid */}
        {facilities.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Nu există facilități disponibile</h2>
            <p className="text-muted-foreground mb-6">
              În acest moment nu există facilități sportive înregistrate în platformă.
            </p>
            <Button variant="sport" asChild>
              <a href="/facility/register">Înregistrează prima facilitate</a>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {facilities.map((facility, index) => (
              <Card key={facility.id} className="group hover:shadow-elegant transition-all duration-300 animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3 relative overflow-hidden">
                      <img 
                        src={facility.images?.[0] || "/placeholder.svg"} 
                        alt={facility.name}
                        className="w-full h-48 md:h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                        {getFacilityTypeLabel(facility.facility_type)}
                      </Badge>
                    </div>
                    
                    <div className="md:w-2/3 p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-1">{facility.name}</h3>
                          <div className="flex items-center text-muted-foreground text-sm">
                            <MapPin className="h-4 w-4 mr-1" />
                            {facility.address}, {facility.city}
                          </div>
                        </div>
                      </div>
                      
                      {facility.description && (
                        <p className="text-sm text-muted-foreground mb-4">{facility.description}</p>
                      )}
                      
                      {facility.amenities && facility.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {facility.amenities.map((amenity) => (
                            <Badge key={amenity} variant="secondary" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="flex items-center">
                          <span className="text-muted-foreground">Capacitate: {facility.capacity}</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="text-2xl font-bold text-primary">
                          {facility.price_per_hour} RON
                          <span className="text-sm font-normal text-muted-foreground">/oră</span>
                        </div>
                        <Button variant="sport">
                          Rezervă Acum
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default FacilitiesPage;