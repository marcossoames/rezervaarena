import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Users, Clock, Calendar, User, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import ImageCarousel from "@/components/ImageCarousel";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
import { processPendingImages } from "@/utils/pendingImagesHandler";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Facility {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  facility_type: string;
  full_address: string; // Renamed from address to match RPC return
  city: string;
  exact_price_per_hour: number; // Renamed to match RPC return
  exact_capacity: number; // Renamed to match RPC return
  exact_capacity_max?: number; // For capacity ranges
  amenities: string[]; // Facility-specific amenities
  general_services: string[]; // Sports complex general services
  images: string[];
  main_image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
  sports_complex_name?: string;
  sports_complex_description?: string;
}

interface BookingWithDetails {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending';
  payment_method: string;
  facility_id: string;
  client_id: string;
  created_at: string; // Add this field for sorting by creation date
  facility_name?: string;
  facility_address?: string;
  facility_type?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
}

const ManageFacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showAllAmenities, setShowAllAmenities] = useState<string | null>(null);
  const [showAllServices, setShowAllServices] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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

      // Check if user has facilities or is marked as facility owner
      const { data: facilities, error: facilityError } = await supabase
        .from('facilities')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);

      const hasFacilities = facilities && facilities.length > 0;
      const isFacilityOwner = profile?.user_type_comment?.includes('Proprietar bază sportivă');

      if (!hasFacilities && !isFacilityOwner) {
        toast({
          title: "Acces restricționat",
          description: "Doar proprietarii de baze sportive pot accesa această pagină",
          variant: "destructive"
        });
        window.location.href = "/";
        return;
      }

      setUserProfile(profile);

      // Process any pending images that might not have been processed during email confirmation
      const imagesProcessed = await processPendingImages();
      if (imagesProcessed) {
        window.location.reload();
        return;
      }

      // Load facilities owned by this user using secure RPC
      const { data: facilitiesData, error } = await supabase
        .rpc('get_owner_facility_details');

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Confirmată</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">În așteptare</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Anulată</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Finalizată</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const toggleFacilityStatus = async (facilityId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('facilities')
      .update({ is_active: !currentStatus })
      .eq('id', facilityId);

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza statusul terenului",
        variant: "destructive"
      });
    } else {
      setFacilities(prev => 
        prev.map(f => f.id === facilityId ? { ...f, is_active: !currentStatus } : f)
      );
      toast({
        title: "Status actualizat",
        description: `Terenul a fost ${!currentStatus ? 'activat' : 'dezactivat'}`
      });
    }
  };

  const deleteFacility = async (facilityId: string) => {
    if (!confirm("Ești sigur că vrei să ștergi acest teren? Această acțiune nu poate fi anulată.")) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user?.id)
      .single();

    const { error } = await supabase
      .from('facilities')
      .delete()
      .eq('id', facilityId);

    if (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge terenul",
        variant: "destructive"
      });
    } else {
      if (profile?.email && profile?.full_name) {
        try {
          await supabase.functions.invoke('send-facility-notification', {
            body: {
              facilityId: facilityId,
              action: "deleted",
              ownerEmail: profile.email,
              ownerName: profile.full_name
            }
          });
        } catch (emailError) {
          console.error('Error sending facility deletion email:', emailError);
        }
      }

      setFacilities(prev => prev.filter(f => f.id !== facilityId));
      toast({
        title: "Teren șters",
        description: "Terenul a fost șters cu succes"
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
          <Link to="/facility-owner-profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 border-2 border-primary/20 hover:border-primary rounded-md px-3 py-2 transition-all duration-200 text-sm mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la profil
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard Baza Sportivă</h1>
              <p className="text-muted-foreground">Gestionează facilitățile și rezervările bazei tale sportive</p>
            </div>
            
            <Link to="/add-facility">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adaugă Teren
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
              <h3 className="text-xl font-semibold mb-2">Niciun teren adăugat</h3>
              <p className="text-muted-foreground mb-6">
                Începe prin a adăuga primul tău teren sportiv
              </p>
              <Link to="/add-facility">
                <Button>Adaugă Primul Teren</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.map((facility) => (
              <Card key={facility.id} className="relative overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                {/* Media Section */}
                <div className="relative h-48 flex-shrink-0 overflow-hidden bg-muted/30">
                  {facility.images && facility.images.length > 0 ? (
                    <ImageCarousel
                      images={facility.images}
                      facilityName={facility.name}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <div className="text-4xl mb-2">📷</div>
                        <p className="text-xs">Nicio imagine</p>
                      </div>
                    </div>
                  )}
                  <Badge 
                    variant={facility.is_active ? "default" : "secondary"}
                    className="absolute top-3 right-3 z-10"
                  >
                    {facility.is_active ? "Activ" : "Inactiv"}
                  </Badge>
                </div>
                
                <CardHeader className="pb-2 flex-shrink-0 py-3">
                  <div className="flex items-start justify-between min-h-[60px]">
                    <div className="flex-1 pr-2">
                      <CardTitle className="text-lg leading-tight line-clamp-2">{facility.name}</CardTitle>
                      <CardDescription className="flex items-start gap-1 mt-1 text-xs">
                        <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight">{facility.full_address}, {facility.city}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                 
                 <CardContent className="flex-1 flex flex-col justify-between p-4 pt-2">
                   <div className="space-y-3 flex-1">
                     <div className="flex items-center justify-between">
                       <Badge variant="outline" className="text-xs">
                         {getFacilityTypeLabel(facility.facility_type)}
                       </Badge>
                     </div>

                     <div className="grid grid-cols-2 gap-2 text-sm">
                       <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md min-h-[50px]">
                         <Users className="h-4 w-4 text-primary flex-shrink-0" />
                         <div className="flex flex-col justify-center min-w-0">
                           <span className="text-xs text-muted-foreground">Capacitate</span>
                           <span className="font-medium text-foreground text-xs leading-tight">
                             {facility.exact_capacity_max 
                               ? `${facility.exact_capacity}-${facility.exact_capacity_max} pers.`
                               : `${facility.exact_capacity} pers.`
                             }
                           </span>
                         </div>
                       </div>
                       <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md min-h-[50px]">
                         <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                         <div className="flex flex-col justify-center min-w-0">
                           <span className="text-xs text-muted-foreground">Preț</span>
                           <span className="font-medium text-foreground text-xs leading-tight">{facility.exact_price_per_hour} RON/h</span>
                         </div>
                       </div>
                     </div>

                     <div className="h-[36px] flex items-start">
                       {facility.description ? (
                         <p className="text-sm text-muted-foreground line-clamp-2 leading-tight">
                           {facility.description}
                         </p>
                       ) : (
                         <p className="text-sm text-muted-foreground italic">Fără descriere</p>
                       )}
                     </div>

                      <div className="min-h-[100px] flex flex-col justify-start space-y-2">
                        {facility.general_services && facility.general_services.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1">Servicii generale:</p>
                            <div className="flex flex-wrap gap-1">
                              {facility.general_services.slice(0, 2).map((service) => (
                                <Badge key={service} variant="outline" className="text-xs">
                                  {service}
                                </Badge>
                              ))}
                              {facility.general_services.length > 2 && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs cursor-pointer hover:bg-primary/10"
                                  onClick={() => setShowAllServices(facility.id)}
                                >
                                  +{facility.general_services.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {facility.amenities && facility.amenities.length > 0 ? (
                          <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1">Dotări teren:</p>
                            <div className="flex flex-wrap gap-1">
                              {facility.amenities.slice(0, 2).map((amenity) => (
                                <Badge key={amenity} variant="secondary" className="text-xs">
                                  {amenity}
                                </Badge>
                              ))}
                              {facility.amenities.length > 2 && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs cursor-pointer hover:bg-primary/10"
                                  onClick={() => setShowAllAmenities(facility.id)}
                                >
                                  +{facility.amenities.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            Fără dotări suplimentare pentru teren
                          </div>
                        )}
                      </div>
                   </div>

                   <div className="flex gap-2 pt-3 mt-auto border-t border-border/30">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/calendar?facilityId=${facility.id}`)}
                      className="flex-1"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Calendar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/edit-facility/${facility.id}`)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editează
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

        {/* Dialog for all amenities */}
        <Dialog open={!!showAllAmenities} onOpenChange={() => setShowAllAmenities(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Toate dotările terenului</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 mt-4">
              {facilities.find(f => f.id === showAllAmenities)?.amenities.map((amenity) => (
                <Badge key={amenity} variant="secondary">
                  {amenity}
                </Badge>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog for all services */}
        <Dialog open={!!showAllServices} onOpenChange={() => setShowAllServices(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Toate serviciile generale</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 mt-4">
              {facilities.find(f => f.id === showAllServices)?.general_services.map((service) => (
                <Badge key={service} variant="outline">
                  {service}
                </Badge>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManageFacilitiesPage;