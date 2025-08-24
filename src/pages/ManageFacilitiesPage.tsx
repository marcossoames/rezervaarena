import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Users, Clock, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import ImageCarousel from "@/components/ImageCarousel";

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
  amenities: string[];
  images: string[];
  main_image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BookingWithDetails {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_method: string;
  facility_id: string;
  client_id: string;
  facility_name?: string;
  facility_type?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
}

const ManageFacilitiesPage = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'facilities' | 'bookings'>('facilities');
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
        
        // Load bookings for the facilities if we have any
        if (facilitiesData && facilitiesData.length > 0) {
          await loadBookings(facilitiesData.map(f => f.id));
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const loadBookings = async (facilityIds: string[]) => {
    try {
      // Get bookings with facility and profile data
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('*')
        .in('facility_id', facilityIds)
        .gte('booking_date', new Date().toISOString().split('T')[0])
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching bookings:', error);
        toast({
          title: "Eroare",
          description: "Nu s-au putut încărca rezervările",
          variant: "destructive"
        });
        return;
      }

      // Enhance bookings with facility and client details
      const enhancedBookings = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          // Get facility details
          const facility = facilities.find(f => f.id === booking.facility_id);
          
          // Get client details
          const { data: clientProfile } = await supabase
            .from('profiles')
            .select('full_name, phone, email')
            .eq('user_id', booking.client_id)
            .single();

          return {
            ...booking,
            facility_name: facility?.name || 'Teren necunoscut',
            facility_type: facility?.facility_type || 'unknown',
            client_name: clientProfile?.full_name || 'Nume nedisponibil',
            client_phone: clientProfile?.phone || 'Telefon nedisponibil',
            client_email: clientProfile?.email || 'Email nedisponibil'
          };
        })
      );

      setBookings(enhancedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

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
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la pagina principală
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

        {/* Tabs for navigation */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'facilities' | 'bookings')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="facilities" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Facilitățile Mele ({facilities.length})
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Rezervări ({bookings.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <TabsContent value="facilities" className="space-y-6">
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
                  <Button>Adaugă Primul Teren</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {facilities.map((facility) => (
                <Card key={facility.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Image Section */}
                  {facility.images && facility.images.length > 0 && (
                    <div className="relative h-48">
                      <ImageCarousel
                        images={facility.images}
                        facilityName={facility.name}
                        className="w-full h-full"
                      />
                      <Badge 
                        variant={facility.is_active ? "default" : "secondary"}
                        className="absolute top-3 right-3 z-10"
                      >
                        {facility.is_active ? "Activ" : "Inactiv"}
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className={facility.images && facility.images.length > 0 ? "pb-2" : ""}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{facility.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {facility.full_address}, {facility.city}
                        </CardDescription>
                      </div>
                      {(!facility.images || facility.images.length === 0) && (
                        <Badge variant={facility.is_active ? "default" : "secondary"}>
                          {facility.is_active ? "Activ" : "Inactiv"}
                        </Badge>
                      )}
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
                          {facility.exact_capacity}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {facility.exact_price_per_hour} RON/h
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
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/facility-calendar/${facility.id}`)}
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

              {/* Settings Button */}
              <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 transition-colors">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="text-center space-y-4">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                      <Edit className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Setări Bază Sportivă</h3>
                      <p className="text-sm text-muted-foreground">
                        Editează numele, adresa și numărul de telefon
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/edit-sports-complex-settings")}
                      className="mt-4"
                    >
                      Editează Setările
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          {/* Bookings List */}
          {bookings.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nicio rezervare</h3>
                <p className="text-muted-foreground">
                  Când clienții vor face rezervări pentru facilitățile tale le vei vedea aici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <Card key={booking.id} className="transition-all duration-200 hover:shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-2">{booking.facility_name}</CardTitle>
                        <div className="flex items-center text-muted-foreground mb-1">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span>{getFacilityTypeLabel(booking.facility_type || 'unknown')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(booking.status)}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 text-primary mr-3" />
                        <div>
                          <p className="font-medium">
                            {format(new Date(booking.booking_date), 'EEEE, d MMMM yyyy', { locale: ro })}
                          </p>
                          <p className="text-sm text-muted-foreground">Data rezervării</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-primary mr-3" />
                        <div>
                          <p className="font-medium">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</p>
                          <p className="text-sm text-muted-foreground">Interval orar</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-primary mr-3" />
                        <div>
                          <p className="font-medium">{booking.client_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.client_phone}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <div className="text-lg font-semibold text-primary">
                        {booking.total_price} RON
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({booking.payment_method === 'card' ? 'Plată cu cardul' : 'Plată cash'})
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/facility-calendar/${booking.facility_id}`)}
                      >
                        Vezi Calendarul
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </div>
    </div>
  );
};

export default ManageFacilitiesPage;