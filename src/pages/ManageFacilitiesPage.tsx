import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Facility {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  address: string;
  city: string;
  price_per_hour: number;
  capacity: number;
  amenities: string[];
  is_active: boolean;
  created_at: string;
}

const ManageFacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/facility/login";
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'facility_owner') {
        toast({
          title: "Acces restricționat",
          description: "Doar proprietarii de baze sportive pot accesa această pagină",
          variant: "destructive"
        });
        window.location.href = "/";
        return;
      }

      setUserProfile(profile);

      // Load facilities owned by this user
      const { data: facilitiesData, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching facilities:', error);
        toast({
          title: "Eroare",
          description: "Nu s-au putut încărca facilitățile",
          variant: "destructive"
        });
      } else {
        setFacilities(facilitiesData || []);
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const getFacilityTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      tennis: "Tenis",
      football: "Fotbal", 
      padel: "Padel",
      swimming: "Înot",
      basketball: "Baschet",
      volleyball: "Volei"
    };
    return types[type] || type;
  };

  const toggleFacilityStatus = async (facilityId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('facilities')
      .update({ is_active: !currentStatus })
      .eq('id', facilityId);

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza statusul facilității",
        variant: "destructive"
      });
    } else {
      setFacilities(prev => 
        prev.map(f => f.id === facilityId ? { ...f, is_active: !currentStatus } : f)
      );
      toast({
        title: "Status actualizat",
        description: `Facilitatea a fost ${!currentStatus ? 'activată' : 'dezactivată'}`
      });
    }
  };

  const deleteFacility = async (facilityId: string) => {
    if (!confirm("Ești sigur că vrei să ștergi această facilitate? Această acțiune nu poate fi anulată.")) {
      return;
    }

    const { error } = await supabase
      .from('facilities')
      .delete()
      .eq('id', facilityId);

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge facilitatea",
        variant: "destructive"
      });
    } else {
      setFacilities(prev => prev.filter(f => f.id !== facilityId));
      toast({
        title: "Facilitate ștearsă",
        description: "Facilitatea a fost ștearsă cu succes"
      });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Se încarcă...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link to="/facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la facilități
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Facilitățile Mele</h1>
              <p className="text-muted-foreground">Gestionează facilitățile bazei tale sportive</p>
            </div>
            
            <Link to="/add-facility">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adaugă Facilitate
              </Button>
            </Link>
          </div>
        </div>

        {/* Facilities Grid */}
        {facilities.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nicio facilitate adăugată</h3>
              <p className="text-muted-foreground mb-6">
                Începe prin a adăuga prima ta facilitate sportivă
              </p>
              <Link to="/add-facility">
                <Button>Adaugă Prima Facilitate</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.map((facility) => (
              <Card key={facility.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{facility.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {facility.city}
                      </CardDescription>
                    </div>
                    <Badge variant={facility.is_active ? "default" : "secondary"}>
                      {facility.is_active ? "Activ" : "Inactiv"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {getFacilityTypeLabel(facility.facility_type)}
                    </Badge>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {facility.capacity}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {facility.price_per_hour} RON/h
                      </div>
                    </div>
                  </div>

                  {facility.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {facility.description}
                    </p>
                  )}

                  {facility.amenities && facility.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {facility.amenities.slice(0, 3).map((amenity) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                      {facility.amenities.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{facility.amenities.length - 3} mai multe
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={facility.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleFacilityStatus(facility.id, facility.is_active)}
                      className="flex-1"
                    >
                      {facility.is_active ? "Dezactivează" : "Activează"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteFacility(facility.id)}
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageFacilitiesPage;