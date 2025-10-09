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
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [sortedBookings, setSortedBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'facilities' | 'bookings'>('facilities');
  const [bookingsSubTab, setBookingsSubTab] = useState<'upcoming' | 'past'>('upcoming');
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check URL params for initial tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'bookings') {
      setActiveTab('bookings');
    }
  }, []);

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
        console.log('Pending images processed successfully');
        // Refresh the page to show updated images
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
        
        // Load bookings for the facilities if we have any
        if (facilitiesData && facilitiesData.length > 0) {
          await loadBookings(facilitiesData.map(f => f.id));
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  // Apply filtering and sorting when bookings or sub-tab changes
  useEffect(() => {
    if (bookings.length > 0) {
      applyFilteringAndSorting(bookings);
    }
  }, [bookings, bookingsSubTab]);

  const loadBookings = async (facilityIds: string[]) => {
    try {
      // Get ALL bookings (not just future ones)
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('*, created_at')
        .in('facility_id', facilityIds)
        .order('created_at', { ascending: false }); // Most recent bookings first

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
          // Get facility details directly from database
          const { data: facilityData } = await supabase
            .from('facilities')
            .select('name, facility_type, city, address')
            .eq('id', booking.facility_id)
            .single();
          
          // Get client details
          const { data: clientProfile } = await supabase
            .from('profiles')
            .select('full_name, phone, email')
            .eq('user_id', booking.client_id)
            .single();

          const isClientDeleted = !clientProfile;

          return {
            ...booking,
            facility_name: facilityData?.name || 'Teren necunoscut',
            facility_address: facilityData ? `${facilityData.city}, ${facilityData.address}` : 'unknown',
            facility_type: facilityData?.facility_type || 'unknown',
            client_name: isClientDeleted ? 'Nume indisponibil (cont șters)' : (clientProfile?.full_name || 'Nume indisponibil'),
            client_phone: isClientDeleted ? 'Telefon indisponibil (cont șters)' : (clientProfile?.phone || 'Telefon indisponibil'),
            client_email: isClientDeleted ? 'Email indisponibil (cont șters)' : (clientProfile?.email || 'Email indisponibil'),
            // Convert any pending status to confirmed, but mark as cancelled if client was deleted
            status: isClientDeleted ? 'cancelled' : (booking.status === 'pending' ? 'confirmed' : booking.status)
          } as BookingWithDetails;
        })
      );

      setBookings(enhancedBookings);
      applyFilteringAndSorting(enhancedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  // Filter and sort bookings based on sub-tab
  const applyFilteringAndSorting = (bookingsToFilter: BookingWithDetails[]) => {
    const now = new Date();
    
    let filtered: BookingWithDetails[];
    
    if (bookingsSubTab === 'upcoming') {
      // Future bookings: start_time > now, exclude cancelled
      filtered = bookingsToFilter.filter(booking => {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
        return bookingDateTime > now && booking.status !== 'cancelled';
      });
      // Sort ascending (next ones first)
      filtered.sort((a, b) => {
        const aDate = new Date(`${a.booking_date}T${a.start_time}`);
        const bDate = new Date(`${b.booking_date}T${b.start_time}`);
        return aDate.getTime() - bDate.getTime();
      });
    } else {
      // Past bookings: end_time < now OR cancelled status
      filtered = bookingsToFilter.filter(booking => {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.end_time}`);
        return bookingDateTime <= now || booking.status === 'cancelled';
      });
      // Sort: FIRST show unprocessed bookings (confirmed/pending), THEN processed ones (completed/no_show/cancelled)
      // Within each group, sort descending (most recent first)
      filtered.sort((a, b) => {
        const aIsUnprocessed = a.status === 'confirmed' || a.status === 'pending';
        const bIsUnprocessed = b.status === 'confirmed' || b.status === 'pending';
        
        // Unprocessed bookings first
        if (aIsUnprocessed && !bIsUnprocessed) return -1;
        if (!aIsUnprocessed && bIsUnprocessed) return 1;
        
        // Within same group, most recent first
        const aDate = new Date(`${a.booking_date}T${a.end_time}`);
        const bDate = new Date(`${b.booking_date}T${b.end_time}`);
        return bDate.getTime() - aDate.getTime();
      });
    }
    
    setSortedBookings(filtered);
  };

  // Helper function to check if booking needs attention
  const needsAttention = (booking: BookingWithDetails) => {
    const now = new Date();
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.end_time}`);
    return bookingDateTime <= now && (booking.status === 'confirmed' || booking.status === 'pending');
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

    // Get facility and user details before deletion
    const facilityToDelete = facilities.find(f => f.id === facilityId);
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
      // Send facility deletion notification email
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
          // Don't fail the deletion if email fails
        }
      }

      setFacilities(prev => prev.filter(f => f.id !== facilityId));
      toast({
        title: "Teren șters",
        description: "Terenul a fost șters cu succes"
      });
    }
  };

  const deleteBooking = async (bookingId: string) => {
    if (!confirm("Ești sigur că vrei să ștergi această rezervare din baza de date? Această acțiune nu poate fi anulată.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Rezervarea a fost ștearsă din baza de date",
      });

      // Remove from local state
      setBookings(prev => prev.filter(booking => booking.id !== bookingId));
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge rezervarea",
        variant: "destructive"
      });
    }
  };

  const canDeleteBooking = (booking: BookingWithDetails) => {
    const bookingDate = new Date(booking.booking_date);
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    // For facility owners: can delete bookings older than 1 month and in the past
    return bookingDate < now && bookingDate < oneMonthAgo;
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

        {/* Tabs for navigation */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'facilities' | 'bookings')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="facilities" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Terenurile Mele ({facilities.length})
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Rezervări ({bookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facilities" className="space-y-6">
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
                  {/* Media Section - always reserved height */}
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
                       {/* Type Badge */}
                       <div className="flex items-center justify-between">
                         <Badge variant="outline" className="text-xs">
                           {getFacilityTypeLabel(facility.facility_type)}
                         </Badge>
                       </div>

                       {/* Capacity and Price - Reduced Height */}
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

                       {/* Description section - Reduced Height */}
                       <div className="h-[36px] flex items-start">
                         {facility.description ? (
                           <p className="text-sm text-muted-foreground line-clamp-2 leading-tight">
                             {facility.description}
                           </p>
                         ) : (
                           <p className="text-sm text-muted-foreground italic">Fără descriere</p>
                         )}
                       </div>

                        {/* Services and Amenities section - More Space */}
                        <div className="min-h-[100px] flex flex-col justify-start space-y-2">
                          {/* General Services (from sports complex) */}
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
                                  <Badge variant="outline" className="text-xs">
                                    +{facility.general_services.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Facility-specific amenities */}
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
                                  <Badge variant="secondary" className="text-xs">
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

                     {/* Buttons - Always at bottom */}
                     <div className="flex gap-2 pt-3 mt-auto border-t border-border/30">
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
          {/* Sub-tabs for Upcoming/Past */}
          <Tabs value={bookingsSubTab} onValueChange={(value) => setBookingsSubTab(value as 'upcoming' | 'past')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upcoming">Rezervări Viitoare</TabsTrigger>
              <TabsTrigger value="past">Rezervări Trecute</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4 mt-6">
              {sortedBookings.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Nicio rezervare viitoare</h3>
                    <p className="text-muted-foreground">
                      Când clienții vor face rezervări pentru terenurile tale le vei vedea aici
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {sortedBookings.map((booking) => (
                    <Card key={booking.id} className="transition-all duration-200 hover:shadow-lg">
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg mb-2">{booking.facility_name}</CardTitle>
                            <div className="flex items-center text-muted-foreground mb-1">
                              <MapPin className="h-4 w-4 mr-2" />
                              <span>{booking.facility_address || 'Locație nedisponibilă'}</span>
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

                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
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

                      {/* Booking Status Manager */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Gestionare Status
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Actualizează statusul rezervării
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookingStatusManager 
                            booking={{
                              id: booking.id,
                              booking_date: booking.booking_date,
                              start_time: booking.start_time,
                              end_time: booking.end_time,
                              status: booking.status,
                              total_price: booking.total_price,
                              payment_method: booking.payment_method,
                              notes: '',
                              client_id: booking.client_id
                            }}
                            onStatusUpdate={() => loadBookings(facilities.map(f => f.id))}
                          />
                          {canDeleteBooking(booking) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteBooking(booking.id)}
                              className="text-xs"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Șterge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4 mt-6">
          {sortedBookings.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Nicio rezervare trecută</h3>
                <p className="text-muted-foreground">
                  Rezervările finalizate și anulate vor apărea aici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedBookings.map((booking) => {
                const requiresAction = needsAttention(booking);
                return (
                <Card 
                  key={booking.id} 
                  className={`transition-all duration-200 hover:shadow-lg ${requiresAction ? 'border-2 border-amber-500 shadow-md' : ''}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg mb-2">{booking.facility_name}</CardTitle>
                          {requiresAction && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                              Marchează ca Finalizată sau Lipsă
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-muted-foreground mb-1">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span>{booking.facility_address || 'Locație nedisponibilă'}</span>
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

                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
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

                      {/* Booking Status Manager */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Gestionare Status
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Actualizează statusul rezervării
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookingStatusManager 
                            booking={{
                              id: booking.id,
                              booking_date: booking.booking_date,
                              start_time: booking.start_time,
                              end_time: booking.end_time,
                              status: booking.status,
                              total_price: booking.total_price,
                              payment_method: booking.payment_method,
                              notes: '',
                              client_id: booking.client_id
                            }}
                            onStatusUpdate={() => loadBookings(facilities.map(f => f.id))}
                          />
                          {canDeleteBooking(booking) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteBooking(booking.id)}
                              className="text-xs"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Șterge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default ManageFacilitiesPage;