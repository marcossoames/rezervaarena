import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, User, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingStatusManager from "@/components/booking/BookingStatusManager";

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
  created_at: string;
  facility_name?: string;
  facility_address?: string;
  facility_type?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
}

const FacilityOwnerBookingsPage = () => {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [sortedBookings, setSortedBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingsSubTab, setBookingsSubTab] = useState<'upcoming' | 'past'>('upcoming');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (bookings.length > 0) {
      applyFilteringAndSorting(bookings);
    }
  }, [bookings, bookingsSubTab]);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/facility/login");
        return;
      }

      // Get user's facilities
      const { data: facilities, error: facilitiesError } = await supabase
        .from('facilities')
        .select('id')
        .eq('owner_id', user.id);

      if (facilitiesError) throw facilitiesError;

      if (facilities && facilities.length > 0) {
        await loadBookings(facilities.map(f => f.id));
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error:', error);
      navigate("/facility/login");
    }
  };

  const loadBookings = async (facilityIds: string[]) => {
    try {
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('*, created_at')
        .in('facility_id', facilityIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        toast({
          title: "Eroare",
          description: "Nu s-au putut încărca rezervările",
          variant: "destructive"
        });
        return;
      }

      const enhancedBookings = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          const { data: facilityData } = await supabase
            .from('facilities')
            .select('name, facility_type, city, address')
            .eq('id', booking.facility_id)
            .single();
          
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

  const applyFilteringAndSorting = (bookingsToFilter: BookingWithDetails[]) => {
    const now = new Date();
    let filtered: BookingWithDetails[];
    
    if (bookingsSubTab === 'upcoming') {
      filtered = bookingsToFilter.filter(booking => {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
        return bookingDateTime > now && booking.status !== 'cancelled';
      });
      filtered.sort((a, b) => {
        const aDate = new Date(`${a.booking_date}T${a.start_time}`);
        const bDate = new Date(`${b.booking_date}T${b.start_time}`);
        return aDate.getTime() - bDate.getTime();
      });
    } else {
      filtered = bookingsToFilter.filter(booking => {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.end_time}`);
        return bookingDateTime <= now || booking.status === 'cancelled';
      });
      filtered.sort((a, b) => {
        const aIsUnprocessed = a.status === 'confirmed' || a.status === 'pending';
        const bIsUnprocessed = b.status === 'confirmed' || b.status === 'pending';
        
        if (aIsUnprocessed && !bIsUnprocessed) return -1;
        if (!aIsUnprocessed && bIsUnprocessed) return 1;
        
        const aDate = new Date(`${a.booking_date}T${a.end_time}`);
        const bDate = new Date(`${b.booking_date}T${b.end_time}`);
        return bDate.getTime() - aDate.getTime();
      });
    }
    
    setSortedBookings(filtered);
  };

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
    return bookingDate < now && bookingDate < oneMonthAgo;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Se încarcă...</p>
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
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/facility-owner-profile")}
            className="mb-4 hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la profil
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground">Rezervările Mele</h1>
          <p className="text-muted-foreground mt-2">Gestionează toate rezervările pentru facilitățile tale</p>
        </div>

        <Tabs value={bookingsSubTab} onValueChange={(value) => setBookingsSubTab(value as 'upcoming' | 'past')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="upcoming">Viitoare ({sortedBookings.filter(b => {
              const bookingDateTime = new Date(`${b.booking_date}T${b.start_time}`);
              return bookingDateTime > new Date() && b.status !== 'cancelled';
            }).length})</TabsTrigger>
            <TabsTrigger value="past">Trecute ({sortedBookings.filter(b => {
              const bookingDateTime = new Date(`${b.booking_date}T${b.end_time}`);
              return bookingDateTime <= new Date() || b.status === 'cancelled';
            }).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {sortedBookings.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">Nicio rezervare viitoare</p>
                </CardContent>
              </Card>
            ) : (
              sortedBookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{booking.facility_name}</CardTitle>
                        <CardDescription>{booking.facility_address}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(booking.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Data și ora</p>
                        <p className="font-medium">
                          {format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: ro })}
                        </p>
                        <p className="text-sm">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Client</p>
                        <p className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {booking.client_name}
                        </p>
                        <p className="text-sm">{booking.client_phone}</p>
                        <p className="text-sm text-muted-foreground">{booking.client_email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Detalii plată</p>
                        <p className="font-bold text-lg">{booking.total_price} RON</p>
                        <p className="text-sm capitalize">{booking.payment_method}</p>
                      </div>
                    </div>

                    <BookingStatusManager
                      booking={booking}
                      onStatusUpdate={async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          const { data: facilities } = await supabase
                            .from('facilities')
                            .select('id')
                            .eq('owner_id', user.id);
                          if (facilities) {
                            await loadBookings(facilities.map(f => f.id));
                          }
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {sortedBookings.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">Nicio rezervare trecută</p>
                </CardContent>
              </Card>
            ) : (
              sortedBookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{booking.facility_name}</CardTitle>
                        <CardDescription>{booking.facility_address}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {needsAttention(booking) && (
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                            Necesită atenție
                          </Badge>
                        )}
                        {getStatusBadge(booking.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Data și ora</p>
                        <p className="font-medium">
                          {format(new Date(booking.booking_date), 'dd MMMM yyyy', { locale: ro })}
                        </p>
                        <p className="text-sm">{booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Client</p>
                        <p className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {booking.client_name}
                        </p>
                        <p className="text-sm">{booking.client_phone}</p>
                        <p className="text-sm text-muted-foreground">{booking.client_email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Detalii plată</p>
                        <p className="font-bold text-lg">{booking.total_price} RON</p>
                        <p className="text-sm capitalize">{booking.payment_method}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <BookingStatusManager
                        booking={booking}
                        onStatusUpdate={async () => {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user) {
                            const { data: facilities } = await supabase
                              .from('facilities')
                              .select('id')
                              .eq('owner_id', user.id);
                            if (facilities) {
                              await loadBookings(facilities.map(f => f.id));
                            }
                          }
                        }}
                      />
                      
                      {canDeleteBooking(booking) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBooking(booking.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Șterge
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default FacilityOwnerBookingsPage;
