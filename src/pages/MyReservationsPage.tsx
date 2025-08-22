import { Calendar, Clock, MapPin, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

const MyReservationsPage = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      
      if (!session) {
        navigate('/client/login');
      } else {
        fetchReservations(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setIsLoading(false);
        
        if (!session) {
          navigate('/client/login');
        } else {
          fetchReservations(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchReservations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          facilities (
            name,
            address,
            city,
            facility_type
          )
        `)
        .eq('client_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      setReservations([]);
    }
  };
  // Show loading while checking authentication or fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Se încarcă...</p>
        </div>
      </div>
    );
  }

  // Don't render the page if not authenticated
  if (!session) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO');
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: 'În așteptare',
      confirmed: 'Confirmată',
      cancelled: 'Anulată',
      completed: 'Finalizată'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Rezervările Mele</h1>
          
          {reservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nu ai rezervări</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Când vei face o rezervare, o vei vedea aici.
                </p>
                <Button asChild>
                  <a href="/facilities">Vezi Facilități</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {reservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{reservation.facilities?.name}</CardTitle>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reservation.status)}`}>
                        {getStatusLabel(reservation.status)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(reservation.booking_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {reservation.facilities?.address}, {reservation.facilities?.city}
                        </span>
                      </div>
                    </div>
                    
                    {reservation.notes && (
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground">
                          <strong>Note:</strong> {reservation.notes}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <div className="text-lg font-semibold">
                        {reservation.total_price} LEI
                      </div>
                      <div className="flex gap-2">
                        {reservation.status === 'pending' && (
                          <>
                            <Button variant="outline" size="sm">
                              Modifică
                            </Button>
                            <Button variant="outline" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Anulează
                            </Button>
                          </>
                        )}
                        {reservation.status === 'confirmed' && (
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Anulează
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default MyReservationsPage;