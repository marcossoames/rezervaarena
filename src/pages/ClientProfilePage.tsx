import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, Calendar, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { deleteUserAccount, checkActiveBookings } from "@/utils/deleteAccount";

const ClientProfilePage = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookingStats, setBookingStats] = useState({ active: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeBookingsInfo, setActiveBookingsInfo] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/client/login");
          return;
        }

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
        }

        // Get booking statistics
        await loadBookingStats(user.id);
        await loadActiveBookings(user.id);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, [navigate]);

  const loadBookingStats = async (userId: string) => {
    try {
      // Get all bookings for stats
      const { data: allBookings, error: allError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('client_id', userId);

      if (allError) {
        console.error('Error loading all bookings:', allError);
        return;
      }

      // Get active bookings (today and future)
      const { data: activeBookingsData, error: activeError } = await supabase
        .from('bookings')
        .select('id')
        .eq('client_id', userId)
        .gte('booking_date', new Date().toISOString().split('T')[0])
        .in('status', ['confirmed', 'pending']);

      if (activeError) {
        console.error('Error loading active bookings:', activeError);
        return;
      }

      setBookingStats({
        active: activeBookingsData?.length || 0,
        total: allBookings?.length || 0
      });
    } catch (error) {
      console.error('Error in loadBookingStats:', error);
      // Don't show error to user, just keep stats at 0
    }
  };

  const loadActiveBookings = async (userId: string) => {
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_date,
          start_time,
          end_time,
          status,
          total_price,
          payment_method,
          facilities!bookings_facility_id_fkey (
            name,
            city,
            address
          )
        `)
        .eq('client_id', userId)
        .gte('booking_date', new Date().toISOString().split('T')[0])
        .in('status', ['confirmed', 'pending'])
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error loading active bookings:', error);
        return;
      }

      setActiveBookings(bookings || []);
    } catch (error) {
      console.error('Error in loadActiveBookings:', error);
      // Don't show error to user, just keep bookings empty
    }
  };

  const handleDeleteClick = async () => {
    const activeBookingsData = await checkActiveBookings();
    setActiveBookingsInfo(activeBookingsData);
    setShowDeleteDialog(true);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteUserAccount();
      
      if (result.success) {
        toast({
          title: "Cont șters",
          description: "Contul tău a fost șters cu succes",
        });
        // Redirect will happen automatically due to auth state change
        navigate("/", { replace: true });
      } else {
        toast({
          title: "Eroare",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la ștergerea contului",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ro-RO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5); // HH:MM
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Se încarcă profilul...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Profil nedisponibil</h2>
            <p className="text-muted-foreground mb-4">
              Nu s-a putut încărca profilul. Te rugăm să te autentifici din nou.
            </p>
            <Button onClick={() => navigate("/client/login")}>
              Autentificare
            </Button>
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Profilul meu</h1>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informații Personale
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nume Complet</label>
                  <p className="text-lg">{userProfile.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg">{userProfile.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefon</label>
                  <p className="text-lg">{userProfile.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tip Utilizator</label>
                  <p className="text-lg">{userProfile.role === 'client' ? 'Client' : userProfile.role}</p>
                </div>
              </CardContent>
            </Card>

            {/* Booking Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Statistici Rezervări
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Rezervări Active</span>
                    <span className="text-2xl font-bold text-primary">{bookingStats.active}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Rezervări</span>
                    <span className="text-2xl font-bold">{bookingStats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Rezervări Complete</span>
                    <span className="text-2xl font-bold text-green-600">{userProfile.completed_bookings || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Rezervări Anulate</span>
                    <span className="text-2xl font-bold text-red-600">{userProfile.cancelled_bookings || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Bookings */}
          {activeBookings.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Rezervările Tale Active</CardTitle>
                <CardDescription>
                  Rezervările tale viitoare și în desfășurare
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeBookings.map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{(booking as any).facilities?.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {(booking as any).facilities?.address}, {(booking as any).facilities?.city}
                          </p>
                          <p className="text-sm">
                            📅 {formatDate(booking.booking_date)} • 
                            🕐 {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{booking.total_price} RON</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {booking.payment_method === 'cash' ? 'Cash' : 'Card'}
                          </p>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                            booking.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {booking.status === 'confirmed' ? 'Confirmată' : 'În așteptare'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="mt-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Zona Periculoasă</CardTitle>
              <CardDescription>
                Acțiuni ireversibile pentru contul tău
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Șterge Contul
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmare Ștergere Cont</AlertDialogTitle>
                    <AlertDialogDescription>
                      {activeBookingsInfo?.activeBookings > 0 ? (
                        <div className="space-y-3">
                          <p className="font-medium text-destructive">
                            ⚠️ Ai {activeBookingsInfo.activeBookings} rezervări active care vor fi anulate automat!
                          </p>
                          <div className="bg-destructive/10 p-3 rounded-lg">
                            <p className="text-sm mb-2">Rezervările care vor fi anulate:</p>
                            <ul className="text-sm space-y-1">
                              {activeBookingsInfo.bookings?.slice(0, 3).map((booking: any) => (
                                <li key={booking.id} className="flex items-center gap-2">
                                  <span>📅 {new Date(booking.booking_date).toLocaleDateString('ro-RO')}</span>
                                  <span>🕐 {booking.start_time}</span>
                                  <span>🏟️ {booking.facilities?.name}</span>
                                </li>
                              ))}
                              {activeBookingsInfo.bookings?.length > 3 && (
                                <li className="text-muted-foreground">
                                  ... și încă {activeBookingsInfo.bookings.length - 3} rezervări
                                </li>
                              )}
                            </ul>
                          </div>
                          <p className="text-sm">
                            Această acțiune este <strong>ireversibilă</strong>. Contul tău și toate datele asociate vor fi șterse permanent.
                          </p>
                        </div>
                      ) : (
                        <p>
                          Această acțiune este ireversibilă. Contul tău și toate datele asociate vor fi șterse permanent.
                        </p>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anulează</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Se șterge..." : "Da, șterge contul definitiv"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ClientProfilePage;
