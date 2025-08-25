import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Building2, Settings, User, Trash2, CreditCard, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { deleteUserAccount } from "@/utils/deleteAccount";

// Bank Account Management Component
const BankAccountCard = () => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState({
    bank_name: '',
    iban: '',
    account_holder_name: ''
  });

  useEffect(() => {
    loadBankInfo();
  }, []);

  const loadBankInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('bank_name, iban, account_holder_name')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setBankInfo({
          bank_name: data.bank_name || '',
          iban: data.iban || '',
          account_holder_name: data.account_holder_name || ''
        });
      }
    } catch (error) {
      console.error('Error loading bank info:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          bank_name: bankInfo.bank_name.trim(),
          iban: bankInfo.iban.trim().replace(/\s/g, ''),
          account_holder_name: bankInfo.account_holder_name.trim()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Datele bancare au fost salvate"
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving bank info:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut salva datele bancare",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const hasBankInfo = bankInfo.bank_name || bankInfo.iban || bankInfo.account_holder_name;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Cont Bancar pentru Plăți
          </CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {hasBankInfo ? 'Editează' : 'Adaugă cont bancar'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nume bancă</label>
              <Input
                value={bankInfo.bank_name}
                onChange={(e) => setBankInfo(prev => ({ ...prev, bank_name: e.target.value }))}
                placeholder="Ex: BRD, BCR, ING, Raiffeisen"
              />
            </div>
            <div>
              <label className="text-sm font-medium">IBAN</label>
              <Input
                value={bankInfo.iban}
                onChange={(e) => setBankInfo(prev => ({ ...prev, iban: e.target.value }))}
                placeholder="RO49AAAA1B31007593840000"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Titular cont</label>
              <Input
                value={bankInfo.account_holder_name}
                onChange={(e) => setBankInfo(prev => ({ ...prev, account_holder_name: e.target.value }))}
                placeholder="Numele complet al titularului"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Se salvează...' : 'Salvează'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  loadBankInfo(); // Reset to original values
                }}
                disabled={loading}
              >
                Anulează
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {hasBankInfo ? (
              <>
                <div>
                  <span className="text-sm text-muted-foreground">Bancă:</span>
                  <p className="font-medium">{bankInfo.bank_name || 'Nu este specificată'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">IBAN:</span>
                  <p className="font-mono font-medium">
                    {bankInfo.iban ? 
                      `${bankInfo.iban.slice(0, 4)} **** **** ${bankInfo.iban.slice(-4)}` : 
                      'Nu este specificat'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Titular:</span>
                  <p className="font-medium">{bankInfo.account_holder_name || 'Nu este specificat'}</p>
                </div>
                <div className="text-xs text-muted-foreground p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">Datele bancare sunt configurate</p>
                      <p className="text-green-700">Administratorul va putea trimite plățile din rezervări direct la acest cont bancar.</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-6">
                <div className="flex flex-col items-center gap-3">
                  <CreditCard className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Nu aveți date bancare configurate</p>
                    <p className="text-sm">Adăugați datele contului bancar pentru a primi plățile din rezervări</p>
                  </div>
                  <div className="text-xs p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p>Clienții pot face rezervări cu cardul, iar administratorul va distribui banii către contul dvs. bancar.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FacilityOwnerProfilePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todayBookings: 0,
    monthlyBookings: 0,
    activeFacilities: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/facility/login');
        return;
      }

      await loadProfile(user.id);
      await loadStats(user.id);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/facility/login');
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut încărca profilul",
        variant: "destructive"
      });
    }
  };

  const loadStats = async (userId: string) => {
    try {
      // Get user's facilities
      const { data: facilities, error: facilitiesError } = await supabase
        .from('facilities')
        .select('id')
        .eq('owner_id', userId);

      if (facilitiesError) {
        throw facilitiesError;
      }

      const facilityIds = facilities.map(f => f.id);

      if (facilityIds.length === 0) {
        setStats({
          todayBookings: 0,
          monthlyBookings: 0,
          activeFacilities: 0
        });
        return;
      }

      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Get this month's start date
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;

      // Get today's bookings
      const { data: todayBookings, error: todayError } = await supabase
        .from('bookings')
        .select('*')
        .in('facility_id', facilityIds)
        .eq('booking_date', today)
        .in('status', ['confirmed', 'pending']);

      console.log('Today bookings:', todayBookings);

      // Get monthly bookings
      const { data: monthlyBookings, error: monthlyError } = await supabase
        .from('bookings')
        .select('*')
        .in('facility_id', facilityIds)
        .gte('booking_date', monthStart)
        .lte('booking_date', `${currentYear}-${(currentMonth).toString().padStart(2, '0')}-31`)
        .in('status', ['confirmed', 'pending']);

      console.log('Monthly bookings:', monthlyBookings);

      if (todayError) throw todayError;
      if (monthlyError) throw monthlyError;

      setStats({
        todayBookings: todayBookings?.length || 0,
        monthlyBookings: monthlyBookings?.length || 0,
        activeFacilities: facilities.length
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractSportsComplexName = (userTypeComment: string): string => {
    if (!userTypeComment) return 'Baza Sportivă';
    
    // Handle format: "Complex Sportiv ABC - Proprietar bază sportivă"
    if (userTypeComment.includes(' - Proprietar bază sportivă')) {
      return userTypeComment.replace(' - Proprietar bază sportivă', '').trim();
    }
    
    // Handle format: "Proprietar bază sportivă - Complex Sportiv ABC"
    if (userTypeComment.startsWith('Proprietar bază sportivă - ')) {
      return userTypeComment.replace('Proprietar bază sportivă - ', '').trim();
    }
    
    return userTypeComment;
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUserAccount();
      toast({
        title: "Cont șters",
        description: "Contul a fost șters cu succes.",
      });
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge contul. Vă rugăm să încercați din nou.",
        variant: "destructive"
      });
    }
  };

  if (isLoading || !profile) {
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

  const sportsComplexName = extractSportsComplexName(profile.user_type_comment || '');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la pagina principală
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Profilul Proprietarului</h1>
          <p className="text-muted-foreground mt-2">
            Gestionează-ți profilul și facilitățile sportive
          </p>
        </div>

        <div className="grid gap-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informații Profil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-4">{sportsComplexName}</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">Nume complet:</span>
                      <p className="font-medium">{profile.full_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Email:</span>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Telefon:</span>
                      <p className="font-medium">{profile.phone}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Rol:</span>
                      <p className="font-medium capitalize">{profile.role}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Rezervări astăzi</p>
                          <p className="text-2xl font-bold">{stats.todayBookings}</p>
                        </div>
                        <Calendar className="h-8 w-8 text-primary" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Rezervări luna aceasta</p>
                          <p className="text-2xl font-bold">{stats.monthlyBookings}</p>
                        </div>
                        <Calendar className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Facilități active</p>
                          <p className="text-2xl font-bold">{stats.activeFacilities}</p>
                        </div>
                        <Building2 className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account Card */}
          <BankAccountCard />

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/my-reservations')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Rezervările Mele
                </CardTitle>
                <CardDescription>
                  Vezi și gestionează rezervările pentru facilitățile tale
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/manage-facilities')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Gestionează Facilități
                </CardTitle>
                <CardDescription>
                  Adaugă, editează sau șterge facilitățile sportive
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/edit-sports-complex-settings')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Setări
                </CardTitle>
                <CardDescription>
                  Editează informațiile complexului sportiv
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Delete Account */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zona Periculoasă
              </CardTitle>
              <CardDescription>
                Acțiuni ireversibile pentru contul tău
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Șterge Contul
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ești absolut sigur?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Această acțiune nu poate fi anulată. Aceasta va șterge definitiv contul tău 
                      și va elimina datele tale de pe serverele noastre.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anulează</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Da, șterge contul
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

export default FacilityOwnerProfilePage;