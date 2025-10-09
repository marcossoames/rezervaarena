import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, Calendar, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { deleteUserAccount, checkActiveBookings } from "@/utils/deleteAccount";
import { validatePhone } from "@/utils/inputValidation";

const ClientProfilePage = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookingStats, setBookingStats] = useState({ active: 0, total: 0, cancelled: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeBookingsInfo, setActiveBookingsInfo] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<any>({});
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

      // Count cancelled bookings specifically
      const cancelledCount = allBookings?.filter(booking => booking.status === 'cancelled').length || 0;

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
        total: allBookings?.length || 0,
        cancelled: cancelledCount
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
          created_at,
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

      // Filter out expired pending bookings (older than 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const filteredBookings = (bookings || []).filter(booking => {
        if (booking.status === 'pending') {
          const bookingCreatedAt = new Date(booking.created_at);
          return bookingCreatedAt >= tenMinutesAgo;
        }
        return true;
      });

      setActiveBookings(filteredBookings);
    } catch (error) {
      console.error('Error in loadActiveBookings:', error);
      // Don't show error to user, just keep bookings empty
    }
  };

  const handleEditToggle = () => {
    if (isEditMode) {
      // Save changes
      handleSaveProfile();
    } else {
      // Enter edit mode
      setEditedProfile({
        full_name: userProfile.full_name,
        phone: userProfile.phone
      });
      setIsEditMode(true);
    }
  };

  const handleSaveProfile = async () => {
    try {
      // Validate phone number
      const phoneValidation = validatePhone(editedProfile.phone);
      if (!phoneValidation.isValid) {
        toast({
          title: "Eroare validare",
          description: phoneValidation.error,
          variant: "destructive"
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editedProfile.full_name,
          phone: editedProfile.phone,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setUserProfile({
        ...userProfile,
        full_name: editedProfile.full_name,
        phone: editedProfile.phone
      });

      setIsEditMode(false);
      toast({
        title: "Profil actualizat",
        description: "Informațiile tale au fost salvate cu succes."
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza profilul.",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedProfile({});
  };

  const handleDeleteClick = async () => {
    const activeBookingsData = await checkActiveBookings();
    setActiveBookingsInfo(activeBookingsData);
    setShowDeleteDialog(true);
  };

  const handleCancelAllBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all active bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('client_id', user.id)
        .gte('booking_date', new Date().toISOString().split('T')[0])
        .in('status', ['confirmed', 'pending']);

      if (!bookings || bookings.length === 0) return;

      // Cancel all bookings
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .in('id', bookings.map(b => b.id));

      if (error) throw error;

      toast({
        title: "Rezervări anulate",
        description: `${bookings.length} rezervări au fost anulate cu succes.`,
      });

      // Refresh active bookings info
      const updatedData = await checkActiveBookings();
      setActiveBookingsInfo(updatedData);
    } catch (error) {
      console.error("Error cancelling bookings:", error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut anula rezervările.",
        variant: "destructive",
      });
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
        navigate("/", { replace: true });
      } else if (result.hasActiveBookings) {
        toast({
          title: "Rezervări active găsite",
          description: result.error,
          variant: "destructive"
        });
        // Redirect to reservations page
        navigate("/my-reservations");
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
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informații Personale
                  </CardTitle>
                  <Button
                    variant={isEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={handleEditToggle}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditMode ? "Salvează" : "Editează"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nume Complet</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedProfile.full_name || ''}
                      onChange={(e) => setEditedProfile({...editedProfile, full_name: e.target.value})}
                      className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <p className="text-lg">{userProfile.full_name}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg text-muted-foreground">{userProfile.email} (nu poate fi modificat)</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefon</label>
                  {isEditMode ? (
                    <div>
                      <input
                        type="tel"
                        value={editedProfile.phone || ''}
                        onChange={(e) => setEditedProfile({...editedProfile, phone: e.target.value})}
                        placeholder="0712 345 678"
                        className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format acceptat: 0712 345 678 sau +40712 345 678
                      </p>
                    </div>
                  ) : (
                    <p className="text-lg">{userProfile.phone}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tip Utilizator</label>
                  <p className="text-lg">{userProfile.role === 'client' ? 'Client' : userProfile.role}</p>
                </div>
                {isEditMode && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCancelEdit} variant="outline" size="sm">
                      Anulează
                    </Button>
                  </div>
                )}
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
                    <span className="text-2xl font-bold text-red-600">{bookingStats.cancelled}</span>
                  </div>
                  <div className="mt-4">
                    <Button 
                      onClick={() => navigate("/my-reservations")}
                      className="w-full"
                      variant="outline"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Rezervările Mele
                    </Button>
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
      <AlertDialog open={showActiveBookingsDialog} onOpenChange={setShowActiveBookingsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rezervări Active Detectate</AlertDialogTitle>
            <AlertDialogDescription>
              Ai {activeBookingsCount} rezervare/rezervări active. Pentru a-ți șterge contul, 
              trebuie mai întâi să anulezi toate rezervările active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Închide</AlertDialogCancel>
            <Button onClick={() => navigate("/my-reservations")}>
              Vezi Rezervările
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune nu poate fi anulată. Contul tău și toate datele asociate vor fi șterse permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting}>
              {isDeleting ? "Se șterge..." : "Șterge Contul"}
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
