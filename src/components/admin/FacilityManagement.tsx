import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, Edit, Trash2, Plus, Users, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
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
}

interface SportsComplex {
  owner_id: string;
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  complex_name: string;
  city: string;
  facilities: Facility[];
  total_facilities: number;
  active_facilities: number;
}

const FacilityManagement = () => {
  const [sportsComplexes, setSportsComplexes] = useState<SportsComplex[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedComplexes, setExpandedComplexes] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadSportsComplexes();
  }, []);

  const loadSportsComplexes = async () => {
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
        .select('user_id, full_name, email, phone, user_type_comment')
        .in('user_id', ownerIds);

      // Create lookup map
      const ownerMap = new Map(ownersData?.map(o => [o.user_id, o]) || []);

      // Group facilities by owner (sports complex)
      const complexMap = new Map<string, SportsComplex>();
      
      facilitiesData?.forEach(facility => {
        const owner = ownerMap.get(facility.owner_id);
        const ownerId = facility.owner_id;
        
        if (!complexMap.has(ownerId)) {
          const owner = ownerMap.get(ownerId);
          
          // Extract business name from user_type_comment
          let complexName = 'Baza Sportivă';
          
          if (owner?.user_type_comment) {
            // Check if the comment contains business name (format: "Business Name - Proprietar bază sportivă")
            const commentParts = owner.user_type_comment.split(' - ');
            if (commentParts.length > 1 && commentParts[1].includes('Proprietar bază sportivă')) {
              complexName = commentParts[0];
            }
          }
          
          // If no business name found, create one based on owner name and location
          if (complexName === 'Baza Sportivă') {
            const ownerFirstName = owner?.full_name?.split(' ')[0] || 'Unknown';
            complexName = `Baza Sportivă ${ownerFirstName} - ${facility.city}`;
          }
          
          complexMap.set(ownerId, {
            owner_id: ownerId,
            owner_name: owner?.full_name || 'Unknown',
            owner_email: owner?.email || 'Unknown',
            owner_phone: owner?.phone,
            complex_name: complexName,
            city: facility.city,
            facilities: [],
            total_facilities: 0,
            active_facilities: 0
          });
        }
        
        const complex = complexMap.get(ownerId)!;
        complex.facilities.push(facility);
        complex.total_facilities++;
        if (facility.is_active) {
          complex.active_facilities++;
        }
      });

      setSportsComplexes(Array.from(complexMap.values()));
    } catch (error) {
      console.error('Error loading sports complexes:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca bazele sportive",
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

      // Update the facility in the sports complexes state
      setSportsComplexes(prev => prev.map(complex => ({
        ...complex,
        facilities: complex.facilities.map(facility => 
          facility.id === facilityId 
            ? { ...facility, is_active: !currentStatus }
            : facility
        ),
        active_facilities: complex.facilities.filter(f => 
          f.id === facilityId ? !currentStatus : f.is_active
        ).length
      })));

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

      // Remove the facility from the sports complexes state
      setSportsComplexes(prev => prev.map(complex => ({
        ...complex,
        facilities: complex.facilities.filter(facility => facility.id !== facilityId),
        total_facilities: complex.total_facilities - 1,
        active_facilities: complex.facilities.filter(f => 
          f.id !== facilityId && f.is_active
        ).length
      })).filter(complex => complex.facilities.length > 0)); // Remove empty complexes

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

  const toggleComplexExpanded = (ownerId: string) => {
    setExpandedComplexes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ownerId)) {
        newSet.delete(ownerId);
      } else {
        newSet.add(ownerId);
      }
      return newSet;
    });
  };

  const getTotalFacilitiesCount = () => {
    return sportsComplexes.reduce((total, complex) => total + complex.total_facilities, 0);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Se încarcă bazele sportive...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Se încarcă bazele sportive...</p>
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
            Baze Sportive ({sportsComplexes.length}) - Total Facilități ({getTotalFacilitiesCount()})
          </CardTitle>
          <Button onClick={() => navigate('/add-facility')}>
            <Plus className="h-4 w-4 mr-2" />
            Adaugă Facilitate
          </Button>
        </CardHeader>
        <CardContent>
          {sportsComplexes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nu există baze sportive în sistem.
            </p>
          ) : (
            <div className="space-y-4">
              {sportsComplexes.map((complex) => (
                <Collapsible 
                  key={complex.owner_id}
                  open={expandedComplexes.has(complex.owner_id)}
                  onOpenChange={() => toggleComplexExpanded(complex.owner_id)}
                >
                  <Card className="border-l-4 border-l-blue-500">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            {expandedComplexes.has(complex.owner_id) ? 
                              <ChevronDown className="h-5 w-5" /> : 
                              <ChevronRight className="h-5 w-5" />
                            }
                            <Building2 className="h-6 w-6 text-blue-600" />
                            <div>
                              <CardTitle className="text-left">
                                {complex.complex_name}
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                  ({complex.owner_name})
                                </span>
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {complex.city} • {complex.total_facilities} facilități ({complex.active_facilities} active)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {complex.owner_email}
                            </Badge>
                            <Badge variant={complex.active_facilities > 0 ? "default" : "secondary"}>
                              {complex.active_facilities}/{complex.total_facilities} active
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid gap-3 ml-8">
                          {complex.facilities.map((facility) => (
                            <Card key={facility.id} className="border border-border/50">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h4 className="font-semibold">{facility.name}</h4>
                                      <Badge variant={facility.is_active ? "default" : "secondary"}>
                                        {facility.is_active ? "Activă" : "Inactivă"}
                                      </Badge>
                                      <Badge variant="outline">
                                        {getFacilityTypeLabel(facility.facility_type)}
                                      </Badge>
                                    </div>
                                    
                                    <div className="grid md:grid-cols-3 gap-2 text-sm text-muted-foreground mb-2">
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {facility.address}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        {facility.price_per_hour} RON/oră
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {facility.capacity} persoane
                                      </div>
                                    </div>

                                    {facility.description && (
                                      <p className="text-xs text-muted-foreground mb-2">
                                        {facility.description}
                                      </p>
                                    )}

                                    {facility.amenities && facility.amenities.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {facility.amenities.slice(0, 3).map((amenity, index) => (
                                          <Badge key={index} variant="secondary" className="text-xs">
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
                                  </div>

                                  <div className="flex flex-col gap-1 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/edit-facility/${facility.id}`)}
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
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
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Șterge
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FacilityManagement;