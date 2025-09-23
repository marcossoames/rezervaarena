import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, CreditCard, Banknote, X, User, ArrowLeft, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import BookingStatusManager from "@/components/booking/BookingStatusManager";
interface BasicBooking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  payment_method: string;
  stripe_session_id?: string;
  facility_id: string;
  client_id: string;
  notes?: string;
  created_at?: string;
}

interface Booking extends BasicBooking {
  facilities: {
    id: string;
    name: string;
    facility_type: string;
    city: string;
    address?: string;
    owner_id?: string;
    sports_complex_name?: string;
    sports_complex_address?: string;
    profiles?: {
      user_type_comment: string;
      full_name: string;
      phone: string;
    } | null;
  };
  client_info?: {
    full_name: string;
    phone: string;
    email: string;
  } | null;
}
const MyReservationsPage = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sortBy, setSortBy] = useState<string>('recent'); // recent, upcoming, date_asc, date_desc, price_asc, price_desc
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if user came from manage-facilities
  const cameFromManageFacilities = location.state?.from === 'manage-facilities';
  
  useEffect(() => {
    loadBookings();
  }, []);

  // Handle highlighting specific booking from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const highlightId = urlParams.get('highlight');
    if (highlightId && highlightId !== 'latest') {
      // Scroll to specific booking
      setTimeout(() => {
        const element = document.getElementById(`booking-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
          }, 3000);
        }
      }, 500);
    } else if (highlightId === 'latest') {
      // Scroll to top and highlight the first (latest) booking
      setTimeout(() => {
        const firstBooking = document.querySelector('[id^="booking-"]') as HTMLElement;
        if (firstBooking) {
          firstBooking.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstBooking.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
          setTimeout(() => {
            firstBooking.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
          }, 3000);
        }
      }, 500);
    }
  }, [location.search, bookings]);

  const checkUserRole = async (user: any) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, role, user_type_comment, full_name, phone')
      .eq('user_id', user.id)
      .single();
    
    return profile;
  };
  const loadBookings = async () => {
    try {
      console.log('Starting to load bookings...');
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      console.log('Current user:', user?.id);
      if (!user) {
        console.log('No user found');
        toast({
          title: "Eroare",
          description: "Trebuie să fiți autentificat pentru a vedea rezervările",
          variant: "destructive"
        });
        return;
      }

      // Check user role to determine what bookings to show
      const profile = await checkUserRole(user);
      setUserProfile(profile);
      
      const isFacilityOwner = profile?.role === 'facility_owner' || 
                             profile?.user_type_comment?.includes('Proprietar bază sportivă');
      const isAdmin = profile?.role === 'admin';

      if (isFacilityOwner || isAdmin) {
        let facilityIds = [];
        
        if (isAdmin) {
          // Admins can see all bookings from all facilities
          const { data: allFacilitiesData, error: allFacilitiesError } = await supabase
            .from('facilities')
            .select('id');

          if (allFacilitiesError) {
            console.error('Error fetching all facilities:', allFacilitiesError);
            throw allFacilitiesError;
          }

          facilityIds = allFacilitiesData?.map(f => f.id) || [];
        } else {
          // For facility owners, get bookings for their facilities
          const { data: facilitiesData, error: facilitiesError } = await supabase
            .from('facilities')
            .select('id')
            .eq('owner_id', user.id);

          if (facilitiesError) {
            console.error('Error fetching facilities:', facilitiesError);
            throw facilitiesError;
          }

          if (!facilitiesData || facilitiesData.length === 0) {
            setBookings([]);
            return;
          }

          facilityIds = facilitiesData.map(f => f.id);
        }
        
        // Get bookings for all facilities owned by this user or all if admin
        const {
          data: userBookings,
          error: bookingsError
        } = await supabase
          .from('bookings')
          .select('*')
          .in('facility_id', facilityIds)
          .order('created_at', { ascending: false }); // Order by creation date first (most recent reservations)

        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
          throw bookingsError;
        }

        console.log('Facility owner/admin bookings:', userBookings);

        if (!userBookings || userBookings.length === 0) {
          setBookings([]);
          return;
        }

        // Get client contact information 
        let clientsInfo = [];
        if (isAdmin) {
          // For admins, get all client info (this might need a different approach)
          const { data: allClientsInfo, error: allClientsError } = await supabase
            .from('profiles')
            .select('user_id, full_name, phone, email');
            
          if (!allClientsError && allClientsInfo) {
            clientsInfo = allClientsInfo.map(client => ({
              client_id: client.user_id,
              client_name: client.full_name,
              client_phone: client.phone,
              client_email: client.email
            }));
          }
        } else {
          // For facility owners, use the secure function
          const { data: ownerClientsInfo, error: ownerClientsError } = await supabase
            .rpc('get_client_info_for_facility_bookings', { facility_owner_id: user.id });
          clientsInfo = ownerClientsInfo || [];
        }

        console.log('Clients info:', clientsInfo);

        // Get facility details for each booking
        const completeBookings = await Promise.all(
          userBookings.map(async (booking) => {
            // Get facility details
            const { data: facilityDetail } = await supabase
              .from('facilities')
              .select('name, facility_type, address, city')
              .eq('id', booking.facility_id)
              .single();

            // Find client info from the RPC result
            const clientInfo = clientsInfo?.find(c => c.client_id === booking.client_id);
            console.log('Client info for booking:', booking.id, clientInfo);

            return {
              ...booking,
              client_info: clientInfo ? {
                full_name: clientInfo.client_name,
                phone: clientInfo.client_phone,
                email: clientInfo.client_email
              } : {
                full_name: 'Client neidentificat',
                phone: 'Contact indisponibil',
                email: 'Email nedisponibil'
              },
              facilities: {
                id: booking.facility_id,
                name: facilityDetail?.name || 'Teren necunoscut',
                facility_type: facilityDetail?.facility_type || 'nedefinit',
                city: facilityDetail?.city || 'Oraș nedefinit',
                address: facilityDetail?.address?.split(', ')[0] || '',
                owner_id: user.id,
                sports_complex_name: profile?.user_type_comment?.replace(' - Proprietar bază sportivă', '') || 'Baza Sportivă',
                sports_complex_address: facilityDetail?.address ? `${facilityDetail.address}, ${facilityDetail.city}` : facilityDetail?.city || 'Adresă nedefinită',
                profiles: profile?.phone ? {
                  user_type_comment: profile.user_type_comment || '',
                  full_name: profile.full_name || '',
                  phone: profile.phone
                } : null
              }
            };
          })
        );

        console.log('Complete facility bookings:', completeBookings);
        setBookings(completeBookings.map(booking => ({
          ...booking,
          status: booking.status === 'pending' ? 'confirmed' : booking.status
        })));

      } else {
        // For regular clients, get their own bookings ordered by most recent first
        const {
          data: userBookings,
          error: bookingsError
        } = await supabase.from('bookings')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false }); // Order by creation date first (most recent reservations)
        
        
        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
          throw bookingsError;
        }
        console.log('User bookings:', userBookings);
        if (!userBookings || userBookings.length === 0) {
          setBookings([]);
          return;
        }

        // Get all facility IDs from bookings
        const facilityIds = [...new Set(userBookings.map(b => b.facility_id))];
        console.log('Facility IDs:', facilityIds);

        // Use the same function as other pages to get complete facility data
        const {
          data: allFacilities,
          error: facilitiesError
        } = await supabase.rpc('get_facilities_for_authenticated_users');
        if (facilitiesError) {
          console.error('Error fetching facilities:', facilitiesError);
          throw facilitiesError;
        }
        console.log('All facilities from RPC:', allFacilities);

        // Filter only the facilities we need
        const facilities = allFacilities?.filter(f => facilityIds.includes(f.id)) || [];
        console.log('Filtered facilities:', facilities);

        // Combine all data
        const completeBookings = userBookings.map(booking => {
          const facility = facilities.find(f => f.id === booking.facility_id);
          console.log('Facility for booking:', facility);
          return {
            ...booking,
            facilities: {
              id: facility?.id || booking.facility_id,
              name: facility?.name || 'Teren nedefinit',
              facility_type: facility?.facility_type || 'nedefinit',
              city: facility?.city || 'Oraș nedefinit',
              address: facility?.sports_complex_address?.split(', ')[0] || '',
              owner_id: facility?.id,
              // Not available in RPC response but not needed
              sports_complex_name: facility?.sports_complex_name || 'Baza Sportivă',
              sports_complex_address: facility?.sports_complex_address || facility?.city || 'Adresă nedefinită',
              profiles: null // Contact info removed for privacy protection
            }
          };
        });
        console.log('Complete bookings:', completeBookings);
        setBookings(completeBookings.map(booking => ({
          ...booking,
          status: booking.status === 'pending' ? 'confirmed' : booking.status
        })));
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca rezervările: " + (error?.message || 'Eroare necunoscută'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const canCancelBooking = (booking: Booking) => {
    if (booking.status === 'cancelled') return false;
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const timeDifference = bookingDateTime.getTime() - now.getTime();
    return timeDifference >= oneDayInMs;
  };
  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Nu sunteți autentificat');
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('cancel-booking', {
        body: {
          bookingId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error && (!data || (data as any).success !== false)) {
        throw error;
      }

      if (data && (data as any).success === false) {
        toast({
          title: "Nu s-a putut anula rezervarea",
          description: (data as any).error || 'A apărut o eroare. Încercați din nou.',
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Rezervare anulată",
        description: (data as any).message || 'Rezervarea a fost anulată cu succes.'
      });

      // Reload bookings to show updated status
      loadBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut anula rezervarea",
        variant: "destructive"
      });
    } finally {
      setCancellingId(null);
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Confirmată</Badge>;
      case 'pending':
        return (
          <div className="flex items-center gap-1">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">În procesare</Badge>
            <div className="text-xs text-muted-foreground" title="Plata prin Stripe este în curs de procesare. Verificați din nou în câteva momente.">
              ℹ️
            </div>
          </div>
        );
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Anulată</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Finalizată</Badge>;
      case 'no_show':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Lipsă</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Sort bookings based on sort criteria
  const getSortedBookings = () => {
    // Apply sorting
    const sortedBookings = [...bookings].sort((a, b) => {
      const now = new Date();
      
      switch (sortBy) {
        case 'recent':
          // Most recently created reservations first
          return new Date(b.created_at || b.booking_date).getTime() - new Date(a.created_at || a.booking_date).getTime();
          
        case 'upcoming':
          // Next upcoming reservations first (only future ones)
          const aDate = new Date(`${a.booking_date}T${a.start_time}`);
          const bDate = new Date(`${b.booking_date}T${b.start_time}`);
          const aIsFuture = aDate > now;
          const bIsFuture = bDate > now;
          
          if (aIsFuture && !bIsFuture) return -1;
          if (!aIsFuture && bIsFuture) return 1;
          if (aIsFuture && bIsFuture) return aDate.getTime() - bDate.getTime();
          return bDate.getTime() - aDate.getTime(); // Past dates in descending order
          
        case 'date_asc':
          // Oldest booking date first
          return new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime();
          
        case 'date_desc':
          // Newest booking date first
          return new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime();
          
        case 'price_asc':
          // Lowest price first
          return (a.total_price || 0) - (b.total_price || 0);
          
        case 'price_desc':
          // Highest price first
          return (b.total_price || 0) - (a.total_price || 0);
          
        default:
          return 0;
      }
    });
    
    return sortedBookings;
  };

  // Function to check if user can manage booking status
  const canManageBookingStatus = (booking: Booking) => {
    if (!userProfile) return false;
    
    // Admins can manage all bookings
    if (userProfile.role === 'admin') return true;
    
    // Facility owners can manage bookings for their facilities
    const isFacilityOwner = userProfile.role === 'facility_owner' || 
                           userProfile.user_type_comment?.includes('Proprietar bază sportivă');
    
    return isFacilityOwner && booking.facilities.owner_id === userProfile.user_id;
  };
  if (loading) {
    return <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă rezervările...</p>
          </div>
        </main>
        <Footer />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => {
                if (cameFromManageFacilities) {
                  navigate('/manage-facilities');
                } else if (userProfile?.role === 'facility_owner' || userProfile?.user_type_comment?.includes('Proprietar bază sportivă')) {
                  navigate('/facility-owner-profile');
                } else if (userProfile?.role === 'admin') {
                  navigate('/admin-dashboard');
                } else {
                  navigate('/client-profile');
                }
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {cameFromManageFacilities ? 'Înapoi la Facilități' : 'Înapoi la Profil'}
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Rezervările Mele</h1>
          <p className="text-muted-foreground">Gestionează-ți rezervările de terenuri sportive</p>
          
          {/* Add sorting for regular clients */}
          {userProfile && !userProfile.user_type_comment?.includes('Proprietar bază sportivă') && userProfile.role !== 'admin' && (
            <div className="mt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground">Sortează după:</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="ml-2 w-auto min-w-[200px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Alege criteriul de sortare" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Cea mai recent făcută</SelectItem>
                      <SelectItem value="upcoming">Cea care urmează</SelectItem>
                      <SelectItem value="date_desc">Data rezervării (recent → vechi)</SelectItem>
                      <SelectItem value="date_asc">Data rezervării (vechi → recent)</SelectItem>
                      <SelectItem value="price_desc">Preț (mare → mic)</SelectItem>
                      <SelectItem value="price_asc">Preț (mic → mare)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {(() => {
          // Updated function to handle sorting without status filtering
          const sortedBookings = getSortedBookings();
          return sortedBookings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Nu ai rezervări
              </h3>
              <p className="text-muted-foreground mb-6">
                {userProfile?.user_type_comment?.includes('Proprietar bază sportivă') || userProfile?.role === 'admin' 
                  ? 'Când clienții vor face rezervări pentru facilitățile tale le vei vedea aici.' 
                  : 'Când vei avea rezervări le vei vedea aici.'}
              </p>
              <Button asChild>
                <a href="/facilities">Explorează Terenurile</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {sortedBookings.map(booking => <Card key={booking.id} id={`booking-${booking.id}`} className="transition-all duration-200 hover:shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl mb-2">{booking.facilities.name}</CardTitle>
                      <div className="flex items-center text-muted-foreground mb-1">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>{booking.facilities.sports_complex_name || 'Baza Sportivă'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{booking.facilities.sports_complex_address || booking.facilities.city}</p>
                      {booking.facilities.profiles?.phone && <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <span className="mr-2">📞</span>
                          <a href={`tel:${booking.facilities.profiles.phone}`} className="text-primary hover:underline">
                            {booking.facilities.profiles.phone}
                          </a>
                        </div>}
                    </div>
                    <div className="text-right">
                      {getStatusBadge(booking.status)}
                      <p className="text-sm text-muted-foreground mt-1">
                        {getFacilityTypeLabel(booking.facilities.facility_type)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-primary mr-3" />
                      <div>
                        <p className="font-medium">
                          {format(new Date(booking.booking_date), 'EEEE, d MMMM yyyy', {
                      locale: ro
                    })}
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
                      {booking.payment_method === 'card' ? <CreditCard className="h-5 w-5 text-primary mr-3" /> : <Banknote className="h-5 w-5 text-primary mr-3" />}
                      <div>
                        <p className="font-medium">{booking.total_price} RON</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.payment_method === 'card' ? 'Plată cu cardul' : 'Plată cash'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Client Information - only for facility owners */}
                  {booking.client_info && (
                    <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Detalii Client:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium">{booking.client_info.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary">📞</span>
                          <a href={`tel:${booking.client_info.phone}`} className="text-primary hover:underline font-medium">
                            {booking.client_info.phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary">📧</span>
                          <a href={`mailto:${booking.client_info.email}`} className="text-primary hover:underline font-medium">
                            {booking.client_info.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact info for regular clients */}
                  {!booking.client_info && booking.facilities.profiles?.phone && (
                    <div className="flex items-center text-sm text-muted-foreground mt-1 mb-4">
                      <span className="mr-2">📞</span>
                      <a href={`tel:${booking.facilities.profiles.phone}`} className="text-primary hover:underline">
                        {booking.facilities.profiles.phone}
                      </a>
                    </div>
                   )}

                  {/* Booking Status Manager for facility owners and admins */}
                  {canManageBookingStatus(booking) && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Gestionare Status
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Actualizează statusul rezervării
                          </span>
                        </div>
                        <BookingStatusManager 
                          booking={{
                            id: booking.id,
                            booking_date: booking.booking_date,
                            start_time: booking.start_time,
                            end_time: booking.end_time,
                            status: booking.status,
                            total_price: booking.total_price,
                            payment_method: booking.payment_method,
                            notes: booking.notes,
                            client_id: booking.client_id
                          }}
                          onStatusUpdate={loadBookings}
                        />
                      </div>
                    </div>
                  )}

                  {booking.status !== 'cancelled' && canCancelBooking(booking) && <div className="flex justify-end pt-4 border-t">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={cancellingId === booking.id} className="text-red-600 border-red-200 hover:bg-red-50">
                            <X className="h-4 w-4 mr-2" />
                            {cancellingId === booking.id ? 'Se anulează...' : 'Anulează rezervarea'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Anulezi această rezervare?</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <p>Această acțiune nu poate fi anulată.</p>
                              {booking.payment_method === 'card' && <p className="font-medium text-green-600">
                                  Banii vor fi returnați în 3-5 zile lucrătoare pe cardul folosit la plată.
                                </p>}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Înapoi</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleCancelBooking(booking.id)} className="bg-red-600 hover:bg-red-700">
                              Da, anulează
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>}

                  {booking.status !== 'cancelled' && !canCancelBooking(booking) && <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground text-center">
                        Rezervarea nu mai poate fi anulată (mai puțin de 24h până la începere)
                      </p>
                    </div>}
                </CardContent>
              </Card>)}
          </div>
        );
        })()}
      </main>
      
      <Footer />
    </div>;
};
export default MyReservationsPage;