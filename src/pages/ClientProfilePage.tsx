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
import { deleteUserAccount } from "@/utils/deleteAccount";

const ClientProfilePage = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookingStats, setBookingStats] = useState({ active: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

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

        if (!profile) {
          toast({
            title: "Eroare",
            description: "Nu s-a putut încărca profilul",
            variant: "destructive"
          });
          navigate("/");
          return;
        }

        setUserProfile(profile);

        // Load booking statistics
        await loadBookingStats(user.id);
      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: "Eroare",
          description: "A apărut o eroare la încărcarea profilului",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const loadBookingStats = async (userId: string) => {
    try {
      console.log('Loading booking stats for user:', userId);
      
      // Get all bookings for the user
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('status, booking_date')
        .eq('client_id', userId);

      console.log('Bookings query result:', { bookings, error });

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      if (bookings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        console.log('Today date for comparison:', today);
        console.log('All bookings:', bookings);
        
        // Calculate active bookings (confirmed or pending, future dates)
        const activeBookings = bookings.filter(booking => {
          const bookingDate = new Date(booking.booking_date);
          const isActiveStatus = booking.status === 'confirmed' || booking.status === 'pending';
          const isFutureDate = bookingDate >= today;
          
          console.log('Booking check:', {
            booking,
            bookingDate,
            isActiveStatus,
            isFutureDate,
            willInclude: isActiveStatus && isFutureDate
          });
          
          return isActiveStatus && isFutureDate;
        }).length;

        // Total bookings count
        const totalBookings = bookings.length;

        console.log('Final booking stats:', {
          active: activeBookings,
          total: totalBookings
        });

        setBookingStats({
          active: activeBookings,
          total: totalBookings
        });
      } else {
        console.log('No bookings data returned');
      }
    } catch (error) {
      console.error('Error loading booking stats:', error);
      // Don't show error to user, just keep stats at 0
    }
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
        navigate("/");
      } else {
        toast({
          title: "Eroare",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Eroare",
        description: "A apărut o eroare la ștergerea contului",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">Încărcare...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">Nu s-a putut încărca profilul</div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {userProfile.full_name}
            </h1>
            <p className="text-sm text-gray-500">
              {userProfile.email}
            </p>
            {userProfile.phone && (
              <p className="text-sm text-gray-500">
                {userProfile.phone}
              </p>
            )}
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Rezervări */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/my-reservations")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Rezervările Mele</CardTitle>
                <CardDescription>
                  Vezi toate rezervările tale
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Vezi Rezervările
                </Button>
              </CardContent>
            </Card>

            {/* Ștergere Cont */}
            <Card className="border-destructive/20 hover:border-destructive/40 transition-colors">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-xl text-destructive">Ștergere Cont</CardTitle>
                <CardDescription>
                  Șterge definitiv contul și toate datele asociate
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Șterge Contul
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ești sigur că vrei să îți ștergi contul?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Această acțiune nu poate fi anulată. Toate datele tale, inclusiv rezervările și informațiile personale, vor fi șterse definitiv.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anulează</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Se șterge..." : "Șterge Contul"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Informații Rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{bookingStats.active}</div>
                  <div className="text-sm text-gray-600">Rezervări Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{bookingStats.total}</div>
                  <div className="text-sm text-gray-600">Rezervări Totale</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ClientProfilePage;