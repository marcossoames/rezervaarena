import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Building2, Settings, User, Trash2, CreditCard, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { deleteUserAccount } from "@/utils/deleteAccount";

// Stripe Connect Component
const StripeConnectCard = ({ userProfile, onStatusUpdate }: { userProfile: any, onStatusUpdate: (updatedProfile: any) => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-create-account', {
        body: { 
          email: userProfile.email,
          country: 'RO',
          business_type: 'individual'
        }
      });

      if (error) throw error;

      toast({
        title: "Cont Stripe creat",
        description: "Contul Stripe a fost creat cu succes. Acum poți începe onboarding-ul.",
      });

      // Sync status after account creation
      await syncStripeStatus();
    } catch (error: any) {
      console.error('Error creating Stripe account:', error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut crea contul Stripe",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboarding = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-onboarding-link');

      if (error) throw error;

      // Open Stripe onboarding in new tab
      window.open(data.url, '_blank');
      
      // Set up periodic status checking after opening onboarding
      const checkInterval = setInterval(async () => {
        await syncStripeStatus();
      }, 30000); // Check every 30 seconds
      
      // Clear interval after 10 minutes
      setTimeout(() => clearInterval(checkInterval), 600000);
    } catch (error: any) {
      console.error('Error creating onboarding link:', error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut crea link-ul de onboarding",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboard = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-dashboard-link');

      if (error) throw error;

      // Open Stripe dashboard in new tab
      window.open(data.url, '_blank');
    } catch (error: any) {
      console.error('Error creating dashboard link:', error);
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut accesa dashboard-ul Stripe",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncStripeStatus = async () => {
    if (!userProfile.stripe_account_id) return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-sync-status');

      if (error) throw error;

      // Update parent component with new status
      onStatusUpdate({
        ...userProfile,
        stripe_onboarding_complete: data.details_submitted,
        stripe_charges_enabled: data.charges_enabled,
        stripe_payouts_enabled: data.payouts_enabled,
      });

      toast({
        title: "Status actualizat",
        description: "Statusul Stripe a fost sincronizat cu succes",
      });
    } catch (error: any) {
      console.error('Error syncing Stripe status:', error);
      toast({
        title: "Eroare sincronizare",
        description: "Nu s-a putut sincroniza statusul Stripe",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync status on component mount if account exists
  useEffect(() => {
    if (userProfile.stripe_account_id && !userProfile.stripe_onboarding_complete) {
      syncStripeStatus();
    }
  }, [userProfile.stripe_account_id]);

  const getStripeStatus = () => {
    if (!userProfile.stripe_account_id) {
      return {
        status: 'not_connected',
        icon: CreditCard,
        color: 'gray',
        title: 'Stripe Connect',
        description: 'Conectează-te la Stripe pentru a primi plăți automat'
      };
    }
    
    if (!userProfile.stripe_onboarding_complete) {
      return {
        status: 'pending',
        icon: AlertCircle,
        color: 'orange',
        title: 'Onboarding Incomplet',
        description: 'Completează configurarea Stripe pentru a primi plăți'
      };
    }

    return {
      status: 'connected',
      icon: CheckCircle,
      color: 'green',
      title: 'Stripe Conectat',
      description: 'Primești automat plățile pentru rezervări'
    };
  };

  const status = getStripeStatus();
  const StatusIcon = status.icon;

  return (
    <Card className={`hover:shadow-lg transition-shadow border-${status.color}-200`}>
      <CardHeader className="text-center pb-4">
        <div className={`w-16 h-16 bg-${status.color}-100 rounded-full flex items-center justify-center mx-auto mb-4`}>
          <StatusIcon className={`h-8 w-8 text-${status.color}-600`} />
        </div>
        <CardTitle className="text-lg">{status.title}</CardTitle>
        <CardDescription className="text-sm">
          {status.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-2">
        {status.status === 'not_connected' && (
          <Button 
            onClick={handleCreateAccount} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Se creează..." : "Conectează Stripe"}
          </Button>
        )}
        
        {status.status === 'pending' && (
          <Button 
            onClick={handleOnboarding} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Se încarcă..." : "Completează Onboarding"}
          </Button>
        )}
        
        {status.status === 'connected' && (
          <Button 
            onClick={handleDashboard} 
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {isLoading ? "Se încarcă..." : "Dashboard Stripe"}
          </Button>
        )}
        
        {userProfile.stripe_account_id && (
          <Button 
            onClick={syncStripeStatus} 
            disabled={isSyncing}
            variant="ghost"
            size="sm"
            className="w-full mt-2"
          >
            {isSyncing ? "Se sincronizează..." : "Sincronizează Status"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const FacilityOwnerProfilePage = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/facility/login");
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

  const extractSportsComplexName = (userTypeComment: string) => {
    console.log('Original user_type_comment:', userTypeComment);
    
    if (!userTypeComment) return userProfile?.full_name || "Baza Sportivă";
    
    // Remove system registration text
    let cleanName = userTypeComment
      .replace(' - înregistrat prin sistem', '')
      .replace(' - Proprietar bază sportivă', '')
      .replace('Proprietar bază sportivă - ', '');
    
    console.log('Clean name after replacements:', cleanName);
    
    // If we end up with just "Proprietar bază sportivă" or similar, use full_name
    if (cleanName === 'Proprietar bază sportivă' || cleanName.trim() === '') {
      return userProfile?.full_name || "Baza Sportivă";
    }
    
    return cleanName;
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

  const sportsComplexName = extractSportsComplexName(userProfile.user_type_comment);

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
              {sportsComplexName}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Rezervări */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/my-reservations")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Rezervări</CardTitle>
                <CardDescription className="text-sm">
                  Vezi toate rezervările pentru facilitățile tale
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Vezi Rezervările
                </Button>
              </CardContent>
            </Card>

            {/* Terenuri */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/manage-facilities")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                  <Building2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-lg">Terenuri</CardTitle>
                <CardDescription className="text-sm">
                  Gestionează facilitățile și terenurile tale
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Gestionează Terenurile
                </Button>
              </CardContent>
            </Card>

            {/* Stripe Connect */}
            <StripeConnectCard userProfile={userProfile} onStatusUpdate={setUserProfile} />

            {/* Setări Bază */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => navigate("/edit-sports-complex-settings")}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors">
                  <Settings className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Setări Bază</CardTitle>
                <CardDescription className="text-sm">
                  Editează informațiile generale ale bazei sportive
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Editează Setările
                </Button>
              </CardContent>
            </Card>

            {/* Ștergere Cont */}
            <Card className="border-destructive/20 hover:border-destructive/40 transition-colors">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-lg text-destructive">Ștergere Cont</CardTitle>
                <CardDescription className="text-sm">
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
                        Această acțiune nu poate fi anulată. Toate datele tale, inclusiv facilitățile, rezervările și informațiile personale, vor fi șterse definitiv.
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">0</div>
                  <div className="text-sm text-gray-600">Rezervări Astăzi</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-gray-600">Rezervări Luna Aceasta</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-gray-600">Terenuri Active</div>
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

export default FacilityOwnerProfilePage;