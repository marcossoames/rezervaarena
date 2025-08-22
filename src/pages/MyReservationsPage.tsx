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
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      
      if (!session) {
        navigate('/client/login');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setIsLoading(false);
        
        if (!session) {
          navigate('/client/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show loading while checking authentication
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

  // Mock data - in a real app, this would come from the database
  const reservations = [
    {
      id: 1,
      facilityName: "Teren de Fotbal Central",
      date: "2024-01-25",
      time: "14:00-16:00",
      price: 120,
      status: "confirmed",
      location: "Strada Sportului 15, București"
    },
    {
      id: 2,
      facilityName: "Teren de Tenis Nord",
      date: "2024-01-27",
      time: "10:00-11:00",
      price: 80,
      status: "confirmed",
      location: "Calea Victoriei 45, București"
    }
  ];

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
                      <CardTitle className="text-xl">{reservation.facilityName}</CardTitle>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        {reservation.status === 'confirmed' ? 'Confirmată' : reservation.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{reservation.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{reservation.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{reservation.location}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-lg font-semibold">
                        {reservation.price} LEI
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Modifică
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Anulează
                        </Button>
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