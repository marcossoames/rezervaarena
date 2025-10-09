import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, MapPin, Clock, User, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  facility_name: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  created_at: string;
}

const FacilityOwnerBookingsPage = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/facility/login");
        return;
      }

      // Get all facilities owned by this user
      const { data: facilities, error: facilitiesError } = await supabase
        .from("facilities")
        .select("id, name")
        .eq("owner_id", user.id);

      if (facilitiesError) throw facilitiesError;

      if (!facilities || facilities.length === 0) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

      const facilityIds = facilities.map((f) => f.id);

      // Get all bookings for these facilities
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_date,
          start_time,
          end_time,
          status,
          total_price,
          facility_id,
          client_id,
          created_at
        `)
        .in("facility_id", facilityIds)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Get client information
      const clientIds = [...new Set(bookingsData?.map((b) => b.client_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", clientIds);

      // Map bookings with facility and client info
      const enrichedBookings = bookingsData?.map((booking) => {
        const facility = facilities.find((f) => f.id === booking.facility_id);
        const client = profiles?.find((p) => p.user_id === booking.client_id);

        return {
          id: booking.id,
          booking_date: booking.booking_date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
          total_price: booking.total_price,
          facility_name: facility?.name || "Necunoscut",
          client_name: client?.full_name || "Client necunoscut",
          client_phone: client?.phone || "Telefon necunoscut",
          client_email: client?.email || "Email necunoscut",
          created_at: booking.created_at,
        };
      }) || [];

      setBookings(enrichedBookings);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca rezervările",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: "Confirmată", className: "bg-green-500 hover:bg-green-600" },
      pending: { label: "În așteptare", className: "bg-yellow-500 hover:bg-yellow-600" },
      cancelled: { label: "Anulată", className: "bg-red-500 hover:bg-red-600" },
      completed: { label: "Completată", className: "bg-blue-500 hover:bg-blue-600" },
      no_show: { label: "Neprezentat", className: "bg-gray-500 hover:bg-gray-600" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const isPastBooking = (bookingDate: string, endTime: string) => {
    const bookingDateTime = new Date(`${bookingDate}T${endTime}`);
    return bookingDateTime < new Date();
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
          <p className="text-muted-foreground mt-2">
            Toate rezervările pentru facilitățile tale (trecute și viitoare)
          </p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Nu există rezervări încă</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bookings.map((booking) => {
              const isPast = isPastBooking(booking.booking_date, booking.end_time);
              
              return (
                <Card key={booking.id} className={isPast ? "opacity-75" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          {booking.facility_name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(booking.booking_date), "dd MMMM yyyy", { locale: ro })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                            </span>
                          </div>
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(booking.status)}
                        {isPast && <Badge variant="outline">Trecută</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Informații Client</h4>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{booking.client_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{booking.client_phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{booking.client_email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Detalii Financiare</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-semibold">{booking.total_price} RON</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Data rezervării:</span>
                            <span>{format(new Date(booking.created_at), "dd MMM yyyy, HH:mm", { locale: ro })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default FacilityOwnerBookingsPage;
