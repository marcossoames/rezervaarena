import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Edit, Trash2, Plus, Users, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Facility {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  city: string;
  address: string;
  price_per_hour: number;
  capacity: number;
  amenities: string[];
  images: string[];
  is_active: boolean;
  created_at: string;
  owner_id: string;
  owner_name?: string;
  owner_email?: string;
}

const FacilityManagement = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadFacilities();
  }, []);

  const loadFacilities = async () => {
    try {
      setIsLoading(true);
      
      // Get all facilities
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select('*')
        .order('created_at', { ascending: false });

      if (facilitiesError) throw facilitiesError;

      // Get owner details for each facility
      const ownerIds = facilitiesData?.map(f => f.owner_id) || [];
      const { data: ownersData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ownerIds);

      // Create lookup map
      const ownerMap = new Map(ownersData?.map(o => [o.user_id, o]) || []);

      const facilitiesWithOwner = facilitiesData?.map(facility => {
        const owner = ownerMap.get(facility.owner_id);
        return {
          ...facility,
          owner_name: owner?.full_name || 'Unknown',
          owner_email: owner?.email || 'Unknown'
        };
      }) || [];

      setFacilities(facilitiesWithOwner);
    } catch (error) {
      console.error('Error loading facilities:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca facilitățile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFacilityStatus = async (facilityId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('facilities')
        .update({ is_active: !currentStatus })
        .eq('id', facilityId);

      if (error) throw error;

      setFacilities(prev => prev.map(facility => 
        facility.id === facilityId 
          ? { ...facility, is_active: !currentStatus }
          : facility
      ));

      toast({
        title: "Succes",
        description: `Facilitatea a fost ${!currentStatus ? 'activată' : 'dezactivată'}`,
      });
    } catch (error) {
      console.error('Error toggling facility status:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza statusul facilității",
        variant: "destructive"
      });
    }
  };

  const deleteFacility = async (facilityId: string, facilityName: string) => {
    if (!confirm(`Ești sigur că vrei să ștergi facilitatea "${facilityName}"? Această acțiune nu poate fi anulată.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facilityId);

      if (error) throw error;

      setFacilities(prev => prev.filter(facility => facility.id !== facilityId));

      toast({
        title: "Succes",
        description: "Facilitatea a fost ștearsă",
      });
    } catch (error) {
      console.error('Error deleting facility:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge facilitatea",
        variant: "destructive"
      });
    }
  };

  const getFacilityTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'football': 'Fotbal',
      'tennis': 'Tenis',
      'basketball': 'Baschet',
      'volleyball': 'Volei',
      'swimming': 'Înot',
      'padel': 'Padel',
      'other': 'Altele'
    };
    return types[type] || type;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestionare Facilități</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Se încarcă facilitățile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Gestionare Facilități ({facilities.length})
          </CardTitle>
          <Button onClick={() => navigate('/add-facility')}>
            <Plus className="h-4 w-4 mr-2" />
            Adaugă Facilitate
          </Button>
        </CardHeader>
        <CardContent>
          {facilities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nu există facilități în sistem.
            </p>
          ) : (
            <div className="grid gap-4">
              {facilities.map((facility) => (
                <Card key={facility.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">{facility.name}</h3>
                          <Badge variant={facility.is_active ? "default" : "secondary"}>
                            {facility.is_active ? "Activă" : "Inactivă"}
                          </Badge>
                          <Badge variant="outline">
                            {getFacilityTypeLabel(facility.facility_type)}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              {facility.address}, {facility.city}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <DollarSign className="h-4 w-4" />
                              {facility.price_per_hour} RON/oră
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              Capacitate: {facility.capacity} persoane
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              <strong>Proprietar:</strong> {facility.owner_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <strong>Email:</strong> {facility.owner_email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <strong>Înregistrată:</strong> {new Date(facility.created_at).toLocaleDateString('ro-RO')}
                            </p>
                          </div>
                        </div>

                        {facility.description && (
                          <p className="text-sm text-muted-foreground mb-4">
                            {facility.description}
                          </p>
                        )}

                        {facility.amenities && facility.amenities.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-2">Facilități:</p>
                            <div className="flex flex-wrap gap-1">
                              {facility.amenities.map((amenity, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {amenity}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/edit-facility/${facility.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editează
                        </Button>
                        
                        <Button
                          variant={facility.is_active ? "secondary" : "default"}
                          size="sm"
                          onClick={() => toggleFacilityStatus(facility.id, facility.is_active)}
                        >
                          {facility.is_active ? "Dezactivează" : "Activează"}
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteFacility(facility.id, facility.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Șterge
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FacilityManagement;